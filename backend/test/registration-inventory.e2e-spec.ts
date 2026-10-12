import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import dotenv from 'dotenv';
import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { InventoryService } from '../src/registrations/inventory.service.js';
import { RegistrationsService } from '../src/registrations/registrations.service.js';
import { PaymentsService } from '../src/payments/payments.service.js';
import { TicketsService } from '../src/tickets/tickets.service.js';
import { ticketQrToken } from '../src/tickets/ticket-crypto.js';
import { CheckinsService } from '../src/checkins/checkins.service.js';
import { OrganizerApplicationsService } from '../src/organizer-applications/organizer-applications.service.js';
import { OrganizerEventsService } from '../src/events/organizer-events.service.js';

describe('registration inventory concurrency (PostgreSQL)', () => {
  let prisma: PrismaService;
  let inventory: InventoryService;
  let registrations: RegistrationsService;
  let organizerId = '';
  let adminId = '';
  let attendeeIds: string[] = [];
  let categoryId = '';
  let eventId = '';
  let ticketTypeId = '';

  beforeAll(async () => {
    dotenv.config({ path: resolve(process.cwd(), '.env') });
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the PostgreSQL inventory integration test');
    prisma = new PrismaService(new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }));
    await prisma.$connect();
    inventory = new InventoryService(prisma);
    registrations = new RegistrationsService(prisma, inventory);

    const suffix = randomUUID();
    const organizer = await prisma.user.create({ data: { clerkUserId: `phase7-organizer-${suffix}`, email: `phase7-organizer-${suffix}@example.invalid`, role: 'ORGANIZER' } });
    organizerId = organizer.id;
    const admin = await prisma.user.create({ data: { clerkUserId: `phase12-admin-${suffix}`, email: `phase12-admin-${suffix}@example.invalid`, role: 'ADMIN' } });
    adminId = admin.id;
    attendeeIds = await Promise.all([1, 2].map(async (index) => {
      const attendee = await prisma.user.create({ data: { clerkUserId: `phase7-attendee-${index}-${suffix}`, email: `phase7-attendee-${index}-${suffix}@example.invalid` } });
      return attendee.id;
    }));
    const category = await prisma.category.create({ data: { name: `Phase 7 ${suffix}`, slug: `phase-7-${suffix}` } });
    categoryId = category.id;
    const organizerApplications = new OrganizerApplicationsService(prisma);
    const application = await organizerApplications.submit(
      await prisma.user.findUniqueOrThrow({ where: { id: attendeeIds[0] } }),
      {
        organizationName: 'Community Events',
        description: 'I want to bring community events to Eventora attendees.',
        contactName: 'Test Applicant',
        contactPhone: '+94770000000',
        organizerType: 'INDIVIDUAL',
        country: 'Sri Lanka',
        city: 'Colombo',
        websiteUrl: null,
        experience: 'I am a beginner and plan my first event.',
        eventFrequency: 'ONE_TIME',
        expectedAttendance: 80,
        categoryIds: [categoryId],
      },
      `phase7-attendee-1-${suffix}@example.invalid`,
    );
    expect(application).toMatchObject({
      organizationName: 'Community Events',
      applicantEmail: `phase7-attendee-1-${suffix}@example.invalid`,
      accuracyConfirmed: true,
      rulesAccepted: true,
      rulesVersion: 'organizer-rules-v1',
      eventCategories: [{ category: { id: categoryId, name: category.name } }],
    });
    expect(application.agreedAt).toBeInstanceOf(Date);
    const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const event = await prisma.event.create({
      data: {
        organizerId,
        categoryId,
        title: 'Inventory concurrency fixture',
        slug: `phase-7-inventory-${suffix}`,
        description: 'Temporary isolated inventory test fixture',
        venue: 'Test venue',
        city: 'Colombo',
        startAt,
        endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
        timezone: 'Asia/Colombo',
        capacity: 1,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    eventId = event.id;
    const ticket = await prisma.ticketType.create({
      data: { eventId, name: 'Single place', price: new Prisma.Decimal('125.40'), currency: 'LKR', quantity: 1 },
    });
    ticketTypeId = ticket.id;
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      if (eventId) {
        const registrationRows = await prisma.registration.findMany({ where: { eventId }, select: { id: true } });
        const registrationIds = registrationRows.map(({ id }) => id);
        await prisma.$transaction(async (tx) => {
          await tx.paymentException.deleteMany({ where: { registrationId: { in: registrationIds } } });
          await tx.emailDelivery.deleteMany({ where: { registrationId: { in: registrationIds } } });
          await tx.checkIn.deleteMany({ where: { eventId } });
          await tx.ticket.deleteMany({ where: { eventId } });
          await tx.paymentAttempt.deleteMany({ where: { registrationId: { in: registrationIds } } });
          await tx.inventoryReservation.deleteMany({ where: { eventId } });
          await tx.registration.deleteMany({ where: { eventId } });
          await tx.eventSession.deleteMany({ where: { eventId } });
          await tx.ticketType.deleteMany({ where: { eventId } });
          await tx.event.delete({ where: { id: eventId } });
          await tx.emailDelivery.deleteMany({ where: { organizerApplication: { applicantId: { in: attendeeIds } } } });
          await tx.organizerApplication.deleteMany({ where: { applicantId: { in: attendeeIds } } });
          await tx.category.delete({ where: { id: categoryId } });
          await tx.user.deleteMany({ where: { id: { in: [organizerId, adminId, ...attendeeIds] } } });
        });
      }
      await prisma.$disconnect();
    }
  }, 30_000);

  it('prevents concurrent overselling, replays idempotently, and expires/releases the hold once', async () => {
    const keys = ['phase7-concurrent-a', 'phase7-concurrent-b'];
    const attempts = await Promise.allSettled(attendeeIds.map((userId, index) =>
      registrations.create(userId, ticketTypeId, 1, keys[index]),
    ));
    const successful = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
    expect(successful, attempts.map((attempt) => attempt.status === 'rejected' ? String(attempt.reason) : 'fulfilled').join('\n')).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const winnerIndex = attempts.findIndex((attempt) => attempt.status === 'fulfilled');
    const winner = successful[0].status === 'fulfilled' ? successful[0].value : undefined;
    expect(winner).toBeDefined();
    expect(winner?.totalAmount).toBe('125.40');
    expect(new Date(winner!.reservation.expiresAt).getTime() - new Date(winner!.createdAt).getTime()).toBe(10 * 60 * 1000);

    const duplicate = await registrations.create(attendeeIds[winnerIndex], ticketTypeId, 1, keys[winnerIndex]);
    expect(duplicate.id).toBe(winner!.id);
    await expect(registrations.create(attendeeIds[winnerIndex], ticketTypeId, 2, keys[winnerIndex])).rejects.toThrow();
    let event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    let ticket = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(event.ticketsReserved + event.ticketsSold).toBe(1);
    expect(ticket.quantityReserved + ticket.quantitySold).toBe(1);
    expect(await prisma.registration.count({ where: { eventId } })).toBe(1);
    expect(await prisma.paymentAttempt.count({ where: { registration: { eventId } } })).toBe(1);

    await prisma.$executeRaw`
      UPDATE "InventoryReservation"
      SET "createdAt" = CURRENT_TIMESTAMP - INTERVAL '11 minutes',
          "expiresAt" = CURRENT_TIMESTAMP - INTERVAL '1 minute',
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "registrationId" = ${winner!.id}
    `;
    expect(await inventory.expireDueReservations(100, eventId)).toBe(1);
    event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    ticket = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(event.ticketsReserved).toBe(0);
    expect(ticket.quantityReserved).toBe(0);
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: winner!.id } })).toMatchObject({ status: 'EXPIRED' });
    expect(await prisma.inventoryReservation.findUniqueOrThrow({ where: { registrationId: winner!.id } })).toMatchObject({ status: 'EXPIRED' });
    expect(await prisma.paymentAttempt.findFirstOrThrow({ where: { registrationId: winner!.id } })).toMatchObject({ status: 'EXPIRED' });

    const next = await registrations.create(attendeeIds[1 - winnerIndex], ticketTypeId, 1, 'phase7-after-expiry');
    expect(next.status).toBe('PENDING');
    await prisma.event.update({ where: { id: eventId }, data: { capacity: 2 } });
    await prisma.ticketType.update({ where: { id: ticketTypeId }, data: { quantity: 2 } });
    const merchantSecret = 'phase8-integration-secret';
    const ticketConfig = new ConfigService({ TICKET_QR_SECRET: 'phase9-integration-qr-secret-with-sufficient-length' });
    const checkins = new CheckinsService(prisma, ticketConfig);
    const payments = new PaymentsService(prisma, new ConfigService({
      PAYHERE_MERCHANT_ID: '1234567',
      PAYHERE_MERCHANT_SECRET: merchantSecret,
      PAYHERE_ENVIRONMENT: 'sandbox',
      PAYHERE_NOTIFY_URL: 'https://example.ngrok-free.app/api/webhooks/payhere/notify',
      PAYHERE_RETURN_URL: 'http://localhost:5173/checkout/result',
      PAYHERE_CANCEL_URL: 'http://localhost:5173/checkout/cancelled',
      TICKET_QR_SECRET: 'phase9-integration-qr-secret-with-sufficient-length',
    }), inventory);
    const checkout = await payments.createCheckout(attendeeIds[1 - winnerIndex], next.id, {
      firstName: 'Test', lastName: 'Attendee', phone: '+94770000000', address: 'Test Road', city: 'Colombo', country: 'Sri Lanka',
    });
    const repeatedCheckout = await payments.createCheckout(attendeeIds[1 - winnerIndex], next.id, {
      firstName: 'Test', lastName: 'Attendee', phone: '+94770000000', address: 'Test Road', city: 'Colombo', country: 'Sri Lanka',
    });
    expect(checkout.checkoutUrl).toBe('https://sandbox.payhere.lk/pay/checkout');
    expect(checkout.fields.amount).toBe('125.40');
    expect(checkout.fields.hash).toMatch(/^[A-F0-9]{32}$/);
    expect(repeatedCheckout.paymentId).toBe(checkout.paymentId);
    const initialAttempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: checkout.paymentId } });
    const failedNotification = signedNotification(merchantSecret, initialAttempt.merchantReference, 'payhere-test-declined', '125.40', 'LKR', '-1');
    await expect(payments.handleNotification(failedNotification)).resolves.toMatchObject({ status: 'FAILED' });
    const retryCheckout = await payments.createCheckout(attendeeIds[1 - winnerIndex], next.id, {
      firstName: 'Test', lastName: 'Attendee', phone: '+94770000000', address: 'Test Road', city: 'Colombo', country: 'Sri Lanka',
    });
    expect(retryCheckout.paymentId).not.toBe(checkout.paymentId);
    const payAttempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: retryCheckout.paymentId } });
    const notification = signedNotification(merchantSecret, payAttempt.merchantReference, 'payhere-test-1', '125.40', 'LKR', '2');
    await expect(payments.handleNotification({ ...notification, md5sig: '0'.repeat(32) })).rejects.toThrow('Invalid PayHere notification signature');
    await expect(payments.handleNotification(notification)).resolves.toMatchObject({ status: 'SUCCEEDED' });
    expect(await prisma.ticket.count({ where: { registrationId: next.id } })).toBe(1);
    expect(await prisma.emailDelivery.count({ where: { registrationId: next.id, type: 'PURCHASE_CONFIRMATION' } })).toBe(1);
    const issuedTicket = await prisma.ticket.findFirstOrThrow({ where: { registrationId: next.id } });
    const tickets = new TicketsService(prisma, ticketConfig);
    await expect(tickets.getMine(attendeeIds[1 - winnerIndex], issuedTicket.id)).resolves.toMatchObject({ reference: issuedTicket.reference, qrCode: expect.stringMatching(/^data:image\/png;base64,/) });
    await expect(tickets.getMine(attendeeIds[winnerIndex], issuedTicket.id)).rejects.toThrow('Ticket not found');
    const qrToken = ticketQrToken(issuedTicket.reference, ticketConfig);
    await expect(checkins.checkIn(organizerId, eventId, qrToken, 'QR_SCAN', false)).resolves.toMatchObject({ outcome: 'VALID', reference: issuedTicket.reference });
    expect(await prisma.checkIn.count({ where: { eventId } })).toBe(0);
    const simultaneousCheckins = await Promise.all([
      checkins.checkIn(organizerId, eventId, qrToken, 'QR_SCAN'),
      checkins.checkIn(organizerId, eventId, issuedTicket.reference, 'MANUAL_REFERENCE'),
    ]);
    expect(simultaneousCheckins.filter(({ outcome }) => outcome === 'CHECKED_IN')).toHaveLength(1);
    expect(simultaneousCheckins.filter(({ outcome }) => outcome === 'ALREADY_CHECKED_IN')).toHaveLength(1);
    await expect(checkins.checkIn(organizerId, eventId, 'not-a-valid-token', 'QR_SCAN')).resolves.toMatchObject({ outcome: 'INVALID' });
    await expect(checkins.checkIn(attendeeIds[0], eventId, issuedTicket.reference, 'MANUAL_REFERENCE')).rejects.toThrow('Event not found');
    await expect(checkins.attendance(organizerId, eventId, 1, 25)).resolves.toMatchObject({ summary: { totalIssued: 1, checkedIn: 1, remaining: 0 }, records: [{ reference: issuedTicket.reference }] });
    const duplicateDeliveries = await Promise.all([payments.handleNotification(notification), payments.handleNotification(notification)]);
    expect(duplicateDeliveries.every(({ status }) => status === 'SUCCEEDED')).toBe(true);
    expect(await prisma.ticket.count({ where: { registrationId: next.id } })).toBe(1);
    expect(await prisma.emailDelivery.count({ where: { registrationId: next.id, type: 'PURCHASE_CONFIRMATION' } })).toBe(1);
    const secondAttemptSuccess = signedNotification(merchantSecret, initialAttempt.merchantReference, 'payhere-test-declined', '125.40', 'LKR', '2');
    await expect(payments.handleNotification(secondAttemptSuccess)).resolves.toMatchObject({ status: 'SUCCEEDED', fulfilled: false });
    expect(await prisma.paymentException.findFirst({ where: { paymentAttemptId: initialAttempt.id, reasonCode: 'MULTIPLE_SUCCESSFUL_ATTEMPTS' } })).not.toBeNull();
    const mismatch = signedNotification(merchantSecret, payAttempt.merchantReference, 'payhere-test-mismatch', '125.41', 'LKR', '2');
    await expect(payments.handleNotification(mismatch)).resolves.toMatchObject({ reason: 'payment_mismatch' });
    expect(await prisma.paymentException.findFirst({ where: { paymentAttemptId: payAttempt.id, reasonCode: 'AMOUNT_MISMATCH' } })).not.toBeNull();
    const chargeback = signedNotification(merchantSecret, payAttempt.merchantReference, 'payhere-test-1', '125.40', 'LKR', '-3');
    await expect(payments.handleNotification(chargeback)).resolves.toMatchObject({ status: 'CHARGEDBACK' });
    expect(await prisma.paymentException.findFirst({ where: { paymentAttemptId: payAttempt.id, reasonCode: 'PAYHERE_CHARGEBACK' } })).not.toBeNull();
    let paidRegistration = await prisma.registration.findUniqueOrThrow({ where: { id: next.id } });
    expect(paidRegistration.status).toBe('CONFIRMED');
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: payAttempt.id } })).toMatchObject({ status: 'CHARGEDBACK', providerAmount: new Prisma.Decimal('125.40'), providerCurrency: 'LKR' });
    event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    ticket = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(event).toMatchObject({ ticketsReserved: 0, ticketsSold: 1 });
    expect(ticket).toMatchObject({ quantityReserved: 0, quantitySold: 1 });

    const pendingCancel = await registrations.create(attendeeIds[winnerIndex], ticketTypeId, 1, 'phase8-cancel-pending');
    const eventManager = new OrganizerEventsService(prisma, {} as never, inventory);
    await expect(eventManager.cancelAsAdmin(adminId, eventId, 'Admin integration cancellation'))
      .resolves.toMatchObject({ id: eventId, status: 'CANCELLED', cancellationNoticesQueued: 1 });
    expect(await prisma.emailDelivery.count({ where: { eventId, type: 'EVENT_CANCELLATION', registrationId: next.id } })).toBe(1);
    event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    ticket = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(event).toMatchObject({ status: 'CANCELLED', cancelledById: adminId, cancellationReason: 'Admin integration cancellation' });
    expect(event.ticketsReserved).toBe(0);
    expect(ticket.quantityReserved).toBe(0);
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: pendingCancel.id } })).toMatchObject({ status: 'EXPIRED' });
    const lateAttempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { registrationId: pendingCancel.id } });
    const lateNotification = signedNotification(merchantSecret, lateAttempt.merchantReference, 'payhere-test-late', '125.40', 'LKR', '2');
    await expect(payments.handleNotification(lateNotification)).resolves.toMatchObject({ status: 'SUCCEEDED', fulfilled: false });
    paidRegistration = await prisma.registration.findUniqueOrThrow({ where: { id: pendingCancel.id } });
    expect(paidRegistration.status).toBe('EXPIRED');
    expect(await prisma.ticket.count({ where: { registrationId: pendingCancel.id } })).toBe(0);
    expect(await prisma.emailDelivery.count({ where: { registrationId: pendingCancel.id, type: 'PURCHASE_CONFIRMATION' } })).toBe(0);
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: lateAttempt.id } })).toMatchObject({ status: 'SUCCEEDED', providerAmount: new Prisma.Decimal('125.40'), providerCurrency: 'LKR' });
    expect(await prisma.paymentException.findFirst({ where: { paymentAttemptId: lateAttempt.id, reasonCode: 'LATE_PAYMENT_UNFULFILLED' } })).not.toBeNull();
    event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    ticket = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(event).toMatchObject({ ticketsReserved: 0, ticketsSold: 1 });
    expect(ticket).toMatchObject({ quantityReserved: 0, quantitySold: 1 });
  }, 60_000);
});

function signedNotification(secret: string, orderId: string, paymentId: string, amount: string, currency: string, status: string) {
  const hashedSecret = createHash('md5').update(secret).digest('hex').toUpperCase();
  const md5sig = createHash('md5').update(`1234567${orderId}${amount}${currency}${status}${hashedSecret}`).digest('hex').toUpperCase();
  return { merchant_id: '1234567', order_id: orderId, payment_id: paymentId, payhere_amount: amount, payhere_currency: currency, status_code: status, md5sig, status_message: 'Test notification' };
}
