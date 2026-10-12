import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../registrations/inventory.service.js';
import { ticketQrHash, ticketQrToken } from '../tickets/ticket-crypto.js';

type Contact = { firstName: string; lastName: string; phone: string; address: string; city: string; country: string };
type PayHereNotification = Record<string, unknown>;
const checkoutInclude = {
  event: { select: { id: true, title: true } },
  ticketType: { select: { id: true, name: true } },
  reservation: { select: { status: true, expiresAt: true } },
} as const;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly inventory: InventoryService,
  ) {}

  async createCheckout(userId: string, registrationId: string, contact: Contact) {
    const config = this.configuration();
    const owned = await this.prisma.registration.findFirst({ where: { id: registrationId, userId }, include: { ...checkoutInclude, attendee: { select: { email: true } }, payments: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (!owned) throw new NotFoundException('Registration not found');
    await this.inventory.expireDueReservations(100, owned.eventId);

    const payment = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Registration" WHERE "id" = ${registrationId} AND "userId" = ${userId} FOR UPDATE`;
      const registration = await tx.registration.findFirst({ where: { id: registrationId, userId }, include: { ...checkoutInclude, attendee: { select: { email: true } }, payments: { orderBy: { createdAt: 'desc' }, take: 1 } } });
      if (!registration) throw new NotFoundException('Registration not found');
      if (registration.status !== 'PENDING') throw new ConflictException('Only pending registrations can be checked out');
      const [activeHold] = await tx.$queryRaw<Array<{ active: boolean }>>`
        SELECT EXISTS (SELECT 1 FROM "InventoryReservation" WHERE "registrationId" = ${registrationId} AND "status" = 'HELD' AND "expiresAt" > CURRENT_TIMESTAMP) AS "active"
      `;
      if (!activeHold?.active) throw new ConflictException('The reservation has expired; create a new registration to continue');
      if (!['LKR', 'USD'].includes(registration.currency)) throw new ConflictException('PayHere checkout supports only LKR and USD ticket prices');

      const latest = registration.payments[0];
      if (latest?.status === 'SUCCEEDED' || latest?.status === 'CHARGEDBACK') throw new ConflictException('This registration already has a completed payment attempt');
      if (latest && ['INITIATED', 'PENDING'].includes(latest.status)) return latest;
      return tx.paymentAttempt.create({
        data: {
          registrationId,
          merchantReference: `EVT-${randomUUID()}`,
          amount: registration.totalAmount,
          currency: registration.currency,
          status: 'INITIATED',
        },
      });
    });

    const fullName = { firstName: contact.firstName.trim(), lastName: contact.lastName.trim() };
    const fields: Record<string, string> = {
      merchant_id: config.merchantId,
      return_url: withRegistration(config.returnUrl, registrationId),
      cancel_url: withRegistration(config.cancelUrl, registrationId),
      notify_url: config.notifyUrl,
      first_name: fullName.firstName,
      last_name: fullName.lastName,
      email: owned.attendee.email,
      phone: contact.phone.trim(),
      address: contact.address.trim(),
      city: contact.city.trim(),
      country: contact.country.trim(),
      order_id: payment.merchantReference,
      items: safeItemName(`${owned.event.title} - ${owned.ticketType.name}`),
      currency: payment.currency,
      amount: payment.amount.toFixed(2),
      hash: checkoutHash(config.merchantId, payment.merchantReference, payment.amount.toFixed(2), payment.currency, config.merchantSecret),
    };
    return { paymentId: payment.id, checkoutUrl: config.checkoutUrl, method: 'POST', fields };
  }

  async handleNotification(body: PayHereNotification) {
    const { merchantId: configuredMerchantId, merchantSecret } = this.merchantConfiguration();
    const merchantId = requiredString(body, 'merchant_id');
    const orderId = requiredString(body, 'order_id');
    const paymentId = requiredString(body, 'payment_id');
    const amountRaw = requiredString(body, 'payhere_amount');
    const currency = requiredString(body, 'payhere_currency');
    const statusRaw = requiredString(body, 'status_code');
    const signature = requiredString(body, 'md5sig').toUpperCase();
    if (merchantId !== configuredMerchantId || !/^-?\d+$/.test(statusRaw) || !/^[A-Z]{3}$/.test(currency) || paymentId.length > 100) {
      throw new BadRequestException('Invalid PayHere notification');
    }
    // Reject unsigned or altered callbacks before looking up or changing payment state.
    if (!verifyNotificationSignature(merchantId, orderId, amountRaw, currency, statusRaw, merchantSecret, signature)) {
      throw new BadRequestException('Invalid PayHere notification signature');
    }
    const statusCode = Number(statusRaw);
    if (![2, 0, -1, -2, -3].includes(statusCode)) throw new BadRequestException('Unsupported PayHere payment status');

    const snapshot = await this.prisma.paymentAttempt.findUnique({ where: { merchantReference: orderId }, include: { registration: { select: { id: true, userId: true, eventId: true, ticketTypeId: true, quantity: true, status: true } } } });
    if (!snapshot) throw new NotFoundException('Payment attempt not found');
    const amount = parseProviderAmount(amountRaw);

    return this.prisma.$transaction(async (tx) => {
      // Lock in the same event → ticket type → reservation → payment order used by inventory operations.
      const [event] = await tx.$queryRaw<Array<{ id: string; status: string; startAt: Date; endAt: Date; capacity: number | null; ticketsReserved: number; ticketsSold: number }>>`
        SELECT "id", "status", "startAt", "endAt", "capacity", "ticketsReserved", "ticketsSold" FROM "Event" WHERE "id" = ${snapshot.registration.eventId} FOR UPDATE
      `;
      const [ticketType] = await tx.$queryRaw<Array<{ id: string; isActive: boolean; quantity: number; quantityReserved: number; quantitySold: number }>>`
        SELECT "id", "isActive", "quantity", "quantityReserved", "quantitySold" FROM "TicketType" WHERE "id" = ${snapshot.registration.ticketTypeId} FOR UPDATE
      `;
      const [reservation] = await tx.$queryRaw<Array<{ id: string; status: string; quantity: number; expiresAt: Date; active: boolean }>>`
        SELECT "id", "status", "quantity", "expiresAt", ("expiresAt" > CURRENT_TIMESTAMP) AS "active" FROM "InventoryReservation" WHERE "registrationId" = ${snapshot.registrationId} FOR UPDATE
      `;
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${snapshot.id} FOR UPDATE`;
      const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: snapshot.id } });
      const now = new Date();
      const statusMessage = typeof body.status_message === 'string' ? body.status_message.slice(0, 80) : `PayHere status ${statusRaw}`;

      const duplicateProviderPayment = await tx.paymentAttempt.findFirst({ where: { providerPaymentId: paymentId, id: { not: current.id } }, select: { id: true } });
      if (duplicateProviderPayment) {
        await this.recordException(tx, current.id, snapshot.registrationId, 'DUPLICATE_PROVIDER_PAYMENT_ID', 'A verified notification referenced a provider payment ID already linked to another attempt.');
        return { received: true, processed: false, reason: 'duplicate_provider_payment_id' };
      }

      const amountMatches = amount !== null && amount.equals(current.amount);
      const currencyMatches = currency === current.currency;
      if (!amountMatches || !currencyMatches) {
        if (statusCode === 2) {
          await tx.paymentAttempt.update({ where: { id: current.id }, data: { status: 'SUCCEEDED', providerPaymentId: current.providerPaymentId ?? paymentId, providerStatus: statusMessage, providerAmount: amount, providerCurrency: currency, paidAt: current.paidAt ?? now, verifiedAt: current.verifiedAt ?? now } });
        }
        await this.recordException(tx, current.id, snapshot.registrationId, !amountMatches ? 'AMOUNT_MISMATCH' : 'CURRENCY_MISMATCH', `Verified PayHere status ${statusRaw} carried ${amount?.toFixed(2) ?? amountRaw} ${currency}; expected ${current.amount.toFixed(2)} ${current.currency}.`);
        return { received: true, processed: false, reason: 'payment_mismatch' };
      }

      if (statusCode === -3) {
        await tx.paymentAttempt.update({ where: { id: current.id }, data: { status: 'CHARGEDBACK', providerPaymentId: current.providerPaymentId ?? paymentId, providerStatus: statusMessage, providerAmount: amount, providerCurrency: currency, paidAt: current.paidAt ?? now, verifiedAt: current.verifiedAt ?? now } });
        await this.recordException(tx, current.id, snapshot.registrationId, 'PAYHERE_CHARGEBACK', 'PayHere reported a chargeback; no automatic refund, ticket void, or inventory reversal was performed.');
        return { received: true, processed: true, status: 'CHARGEDBACK' };
      }

      if (current.status === 'SUCCEEDED' || current.status === 'CHARGEDBACK') {
        if (current.providerPaymentId && current.providerPaymentId !== paymentId) {
          await this.recordException(tx, current.id, snapshot.registrationId, 'MULTIPLE_SUCCESS_NOTIFICATIONS', 'A second verified success notification reported a different PayHere payment ID for this attempt.');
        }
        return { received: true, processed: true, status: current.status };
      }

      if (current.providerPaymentId && current.providerPaymentId !== paymentId) {
        await this.recordException(tx, current.id, snapshot.registrationId, 'MULTIPLE_PROVIDER_PAYMENT_IDS', 'PayHere reported a different payment ID for the same order; the verified status is preserved for review.');
        if (statusCode === 2) {
          await tx.paymentAttempt.update({ where: { id: current.id }, data: { status: 'SUCCEEDED', providerStatus: statusMessage, providerAmount: amount, providerCurrency: currency, paidAt: current.paidAt ?? now, verifiedAt: current.verifiedAt ?? now } });
          return { received: true, processed: true, status: 'SUCCEEDED', fulfilled: false };
        }
        return { received: true, processed: true, status: current.status };
      }

      if (statusCode === 2) {
        // A successful charge and a fulfillable reservation are separate facts; never invent inventory when capacity is gone.
        const otherSuccessfulAttempt = await tx.paymentAttempt.findFirst({
          where: { registrationId: snapshot.registrationId, id: { not: current.id }, status: { in: ['SUCCEEDED', 'CHARGEDBACK'] } },
          select: { id: true },
        });
        if (otherSuccessfulAttempt) {
          await tx.paymentAttempt.update({ where: { id: current.id }, data: { status: 'SUCCEEDED', providerPaymentId: current.providerPaymentId ?? paymentId, providerStatus: statusMessage, providerAmount: amount, providerCurrency: currency, paidAt: current.paidAt ?? now, verifiedAt: current.verifiedAt ?? now } });
          await this.recordException(tx, current.id, snapshot.registrationId, 'MULTIPLE_SUCCESSFUL_ATTEMPTS', 'More than one payment attempt for this registration received a verified success; inventory was not committed again.');
          return { received: true, processed: true, status: 'SUCCEEDED', fulfilled: false };
        }
      }

      if (statusCode === 0) {
        if (current.status !== 'EXPIRED') await tx.paymentAttempt.update({ where: { id: current.id }, data: { status: 'PENDING', providerPaymentId: current.providerPaymentId ?? paymentId, providerStatus: statusMessage, providerAmount: amount, providerCurrency: currency } });
        return { received: true, processed: true, status: current.status === 'EXPIRED' ? 'EXPIRED' : 'PENDING' };
      }
      if (statusCode === -1 || statusCode === -2) {
        if (current.status !== 'EXPIRED') await tx.paymentAttempt.update({ where: { id: current.id }, data: { status: 'FAILED', providerPaymentId: current.providerPaymentId ?? paymentId, providerStatus: statusMessage, providerAmount: amount, providerCurrency: currency } });
        return { received: true, processed: true, status: current.status === 'EXPIRED' ? 'EXPIRED' : 'FAILED' };
      }

      if (!event || !ticketType || !reservation) {
        await this.markSuccessfulButUnfulfilled(tx, current, snapshot.registrationId, paymentId, amount!, currency, statusMessage, now, 'PAYMENT_RELATIONSHIP_MISSING', 'The verified payment succeeded but the reservation relationship could not be found.');
        return { received: true, processed: true, status: 'SUCCEEDED', fulfilled: false };
      }
      if (reservation.status === 'COMMITTED' && snapshot.registration.status === 'CONFIRMED') {
        await tx.paymentAttempt.update({ where: { id: current.id }, data: { status: 'SUCCEEDED', providerPaymentId: current.providerPaymentId ?? paymentId, providerStatus: statusMessage, providerAmount: amount, providerCurrency: currency, paidAt: current.paidAt ?? now, verifiedAt: current.verifiedAt ?? now } });
        await this.ensureTickets(tx, snapshot.registrationId);
        return { received: true, processed: true, status: 'SUCCEEDED', fulfilled: true };
      }

      const holdActive = reservation.status === 'HELD' && reservation.active;
      const releasedHeldQuantity = reservation.status === 'HELD' ? reservation.quantity : 0;
      const canFulfill = event.status === 'PUBLISHED'
        && event.startAt.getTime() > now.getTime()
        && event.endAt.getTime() > now.getTime()
        && ticketType.isActive
        && reservation.status !== 'COMMITTED'
        && (holdActive || ((event.capacity === null || event.ticketsReserved - releasedHeldQuantity + event.ticketsSold + snapshot.registration.quantity <= event.capacity)
          && ticketType.quantityReserved - releasedHeldQuantity + ticketType.quantitySold + snapshot.registration.quantity <= ticketType.quantity));

      if (!canFulfill) {
        if (reservation.status === 'HELD') await this.releaseExpiredHold(tx, event.id, ticketType.id, reservation, snapshot.registrationId, now);
        await this.markSuccessfulButUnfulfilled(tx, current, snapshot.registrationId, paymentId, amount!, currency, statusMessage, now, 'LATE_PAYMENT_UNFULFILLED', 'The verified payment succeeded after the reservation could no longer be fulfilled within event or ticket availability.');
        return { received: true, processed: true, status: 'SUCCEEDED', fulfilled: false };
      }

      if (holdActive) {
        const eventUpdated = await tx.event.updateMany({ where: { id: event.id, ticketsReserved: { gte: snapshot.registration.quantity } }, data: { ticketsReserved: { decrement: snapshot.registration.quantity }, ticketsSold: { increment: snapshot.registration.quantity } } });
        const ticketUpdated = await tx.ticketType.updateMany({ where: { id: ticketType.id, quantityReserved: { gte: snapshot.registration.quantity } }, data: { quantityReserved: { decrement: snapshot.registration.quantity }, quantitySold: { increment: snapshot.registration.quantity } } });
        if (eventUpdated.count !== 1 || ticketUpdated.count !== 1) throw new Error('PAYMENT_INVENTORY_COUNTER_MISMATCH');
      } else {
        if (reservation.status === 'HELD') await this.releaseExpiredHold(tx, event.id, ticketType.id, reservation, snapshot.registrationId, now);
        const eventUpdated = await tx.event.updateMany({ where: { id: event.id, status: 'PUBLISHED', ...(event.capacity === null ? {} : { ticketsReserved: { lte: event.capacity - snapshot.registration.quantity - event.ticketsSold } }) }, data: { ticketsSold: { increment: snapshot.registration.quantity } } });
        const ticketUpdated = await tx.ticketType.updateMany({ where: { id: ticketType.id, isActive: true, quantitySold: { lte: ticketType.quantity - snapshot.registration.quantity - ticketType.quantityReserved } }, data: { quantitySold: { increment: snapshot.registration.quantity } } });
        if (eventUpdated.count !== 1 || ticketUpdated.count !== 1) {
          await this.markSuccessfulButUnfulfilled(tx, current, snapshot.registrationId, paymentId, amount!, currency, statusMessage, now, 'LATE_PAYMENT_UNFULFILLED', 'Inventory changed while reconciling the late payment.');
          return { received: true, processed: true, status: 'SUCCEEDED', fulfilled: false };
        }
      }

      await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: 'COMMITTED', committedAt: now, releasedAt: null } });
      await tx.registration.update({ where: { id: snapshot.registrationId }, data: { status: 'CONFIRMED', confirmedAt: now, expiredAt: null } });
      await tx.paymentAttempt.update({ where: { id: current.id }, data: { status: 'SUCCEEDED', providerPaymentId: current.providerPaymentId ?? paymentId, providerStatus: statusMessage, providerAmount: amount, providerCurrency: currency, paidAt: current.paidAt ?? now, verifiedAt: current.verifiedAt ?? now } });
      await this.ensureTickets(tx, snapshot.registrationId);
      return { received: true, processed: true, status: 'SUCCEEDED', fulfilled: true };
    });
  }

  private async ensureTickets(tx: Prisma.TransactionClient, registrationId: string) {
    const registration = await tx.registration.findUniqueOrThrow({
      where: { id: registrationId },
      include: { attendee: { select: { email: true } }, event: { select: { id: true } }, tickets: { select: { id: true, reference: true } } },
    });
    if (registration.status !== 'CONFIRMED') throw new Error('TICKETS_REQUIRE_CONFIRMED_REGISTRATION');
    // Webhooks may be retried, so issue a complete ticket set once and queue its email idempotently.
    if (registration.tickets.length === 0) {
      const tickets = Array.from({ length: registration.quantity }, () => {
        const reference = `EVT-${randomBytes(12).toString('hex').toUpperCase()}`;
        const qrToken = ticketQrToken(reference, this.config);
        return { registrationId, eventId: registration.eventId, ticketTypeId: registration.ticketTypeId, reference, qrTokenHash: ticketQrHash(qrToken) };
      });
      await tx.ticket.createMany({ data: tickets });
    } else if (registration.tickets.length !== registration.quantity) {
      throw new Error('TICKET_COUNT_DOES_NOT_MATCH_CONFIRMED_QUANTITY');
    }
    await tx.emailDelivery.createMany({
      data: [{ type: 'PURCHASE_CONFIRMATION', idempotencyKey: `purchase-confirmation:${registrationId}`, recipient: registration.attendee.email, registrationId, eventId: registration.event.id }],
      skipDuplicates: true,
    });
  }

  async listMine(userId: string) {
    const attempts = await this.prisma.paymentAttempt.findMany({ where: { registration: { userId } }, orderBy: { createdAt: 'desc' }, take: 50, include: { registration: { select: { id: true, status: true, totalAmount: true, currency: true, event: { select: { id: true, title: true } } } } } });
    return attempts.map(formatPayment);
  }

  async getMine(userId: string, paymentId: string) {
    const attempt = await this.prisma.paymentAttempt.findFirst({ where: { id: paymentId, registration: { userId } }, include: { registration: { select: { id: true, status: true, totalAmount: true, currency: true, event: { select: { id: true, title: true } } } } } });
    if (!attempt) throw new NotFoundException('Payment not found');
    return formatPayment(attempt);
  }

  private configuration() {
    const { merchantId, merchantSecret } = this.merchantConfiguration();
    const notifyUrl = this.config.get<string>('PAYHERE_NOTIFY_URL')?.trim();
    const returnUrl = this.config.get<string>('PAYHERE_RETURN_URL')?.trim();
    const cancelUrl = this.config.get<string>('PAYHERE_CANCEL_URL')?.trim();
    const environment = this.config.get<string>('PAYHERE_ENVIRONMENT', 'sandbox');
    if (!notifyUrl || !returnUrl || !cancelUrl) {
      throw new ServiceUnavailableException('PayHere checkout is not configured; set the backend callback, return, and cancel URLs');
    }
    if (environment !== 'sandbox' && environment !== 'live') throw new ServiceUnavailableException('PAYHERE_ENVIRONMENT must be sandbox or live');
    if (!isHttpsUrl(notifyUrl) || !isHttpUrl(returnUrl) || !isHttpUrl(cancelUrl)) throw new ServiceUnavailableException('PayHere URLs must use HTTPS for notifications and HTTP or HTTPS for browser redirects');
    return {
      merchantId,
      merchantSecret,
      notifyUrl,
      returnUrl,
      cancelUrl,
      checkoutUrl: environment === 'sandbox' ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout',
    };
  }

  private merchantConfiguration() {
    const merchantId = this.config.get<string>('PAYHERE_MERCHANT_ID')?.trim();
    const merchantSecret = this.config.get<string>('PAYHERE_MERCHANT_SECRET')?.trim();
    if (!merchantId || !/^\d{4,20}$/.test(merchantId) || !merchantSecret) {
      throw new ServiceUnavailableException('PayHere notifications are not configured; set the backend merchant ID and secret');
    }
    return { merchantId, merchantSecret };
  }

  private async markSuccessfulButUnfulfilled(tx: Prisma.TransactionClient, payment: { id: string; providerPaymentId: string | null; paidAt: Date | null; verifiedAt: Date | null }, registrationId: string, providerPaymentId: string, amount: Prisma.Decimal, currency: string, providerStatus: string, now: Date, reason: string, description: string) {
    await tx.paymentAttempt.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED', providerPaymentId: payment.providerPaymentId ?? providerPaymentId, providerStatus, providerAmount: amount, providerCurrency: currency, paidAt: payment.paidAt ?? now, verifiedAt: payment.verifiedAt ?? now } });
    await this.recordException(tx, payment.id, registrationId, reason, description);
  }

  private async releaseExpiredHold(tx: Prisma.TransactionClient, eventId: string, ticketTypeId: string, reservation: { quantity: number; status: string }, registrationId: string, now: Date) {
    const eventUpdate = await tx.event.updateMany({ where: { id: eventId, ticketsReserved: { gte: reservation.quantity } }, data: { ticketsReserved: { decrement: reservation.quantity } } });
    const ticketUpdate = await tx.ticketType.updateMany({ where: { id: ticketTypeId, quantityReserved: { gte: reservation.quantity } }, data: { quantityReserved: { decrement: reservation.quantity } } });
    if (eventUpdate.count !== 1 || ticketUpdate.count !== 1) throw new Error('PAYMENT_RESERVATION_COUNTER_MISMATCH');
    await tx.inventoryReservation.updateMany({ where: { registrationId, status: 'HELD' }, data: { status: 'EXPIRED', releasedAt: now } });
    await tx.registration.updateMany({ where: { id: registrationId, status: 'PENDING' }, data: { status: 'EXPIRED', expiredAt: now } });
  }

  private async recordException(tx: Prisma.TransactionClient, paymentAttemptId: string, registrationId: string, reasonCode: string, description: string) {
    const lockKey = `payhere-exception:${paymentAttemptId}:${reasonCode}`;
    await tx.$queryRaw`SELECT 1 AS "locked" FROM (SELECT pg_advisory_xact_lock(hashtext(${lockKey}))) AS acquired`;
    const existing = await tx.paymentException.findFirst({ where: { paymentAttemptId, reasonCode }, select: { id: true } });
    if (!existing) await tx.paymentException.create({ data: { paymentAttemptId, registrationId, reasonCode, description } });
  }
}

function checkoutHash(merchantId: string, orderId: string, amount: string, currency: string, secret: string) {
  const hashedSecret = createHash('md5').update(secret).digest('hex').toUpperCase();
  return createHash('md5').update(`${merchantId}${orderId}${amount}${currency}${hashedSecret}`).digest('hex').toUpperCase();
}

function verifyNotificationSignature(merchantId: string, orderId: string, amount: string, currency: string, statusCode: string, secret: string, received: string) {
  const hashedSecret = createHash('md5').update(secret).digest('hex').toUpperCase();
  const expected = createHash('md5').update(`${merchantId}${orderId}${amount}${currency}${statusCode}${hashedSecret}`).digest('hex').toUpperCase();
  if (!/^[A-F0-9]{32}$/.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, 'ascii'), Buffer.from(received, 'ascii'));
}

function requiredString(body: PayHereNotification, key: string) {
  const value = body[key];
  if (typeof value !== 'string' || value.length < 1 || value.length > 160) throw new BadRequestException(`Invalid PayHere field: ${key}`);
  return value;
}

function parseProviderAmount(value: string) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return null;
  try {
    const amount = new Prisma.Decimal(value);
    return amount.greaterThan(0) ? amount : null;
  } catch {
    return null;
  }
}

function isHttpsUrl(value: string) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function isHttpUrl(value: string) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}

function withRegistration(value: string, registrationId: string) {
  const url = new URL(value);
  url.searchParams.set('registrationId', registrationId);
  return url.toString();
}

function safeItemName(value: string) {
  return value.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').slice(0, 100) || 'Eventora ticket';
}

function formatPayment(payment: { id: string; status: string; amount: Prisma.Decimal; currency: string; providerAmount: Prisma.Decimal | null; providerCurrency: string | null; providerStatus: string | null; createdAt: Date; paidAt: Date | null; registration: { id: string; status: string; totalAmount: Prisma.Decimal; currency: string; event: { id: string; title: string } } }) {
  return {
    id: payment.id,
    status: payment.status,
    amount: payment.amount.toFixed(2),
    currency: payment.currency,
    providerAmount: payment.providerAmount?.toFixed(2) ?? null,
    providerCurrency: payment.providerCurrency,
    providerStatus: payment.providerStatus,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
    registration: { id: payment.registration.id, status: payment.registration.status, totalAmount: payment.registration.totalAmount.toFixed(2), currency: payment.registration.currency, event: payment.registration.event },
  };
}
