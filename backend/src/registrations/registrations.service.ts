import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from './inventory.service.js';

const registrationInclude = {
  event: { select: { id: true, title: true, venue: true, city: true, startAt: true, endAt: true, status: true } },
  ticketType: { select: { id: true, name: true } },
  reservation: { select: { status: true, expiresAt: true } },
  payments: { select: { id: true, status: true, amount: true, currency: true }, orderBy: { createdAt: 'desc' as const }, take: 1 },
} as const;

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService) {}

  async create(userId: string, ticketTypeId: string, quantity: number, idempotencyKey: string) {
    // Fast-path retries; the unique key and recovery below handle simultaneous first requests.
    const existing = await this.findByIdempotency(userId, idempotencyKey);
    if (existing) return this.replay(existing, ticketTypeId, quantity);

    const ticketType = await this.prisma.ticketType.findUnique({ where: { id: ticketTypeId }, select: { id: true, eventId: true } });
    if (!ticketType) throw new NotFoundException('Ticket type not found');
    await this.inventory.expireDueReservations(100, ticketType.eventId);

    try {
      const registration = await this.prisma.$transaction(async (tx) => {
        const snapshot = await this.inventory.reserve(tx, ticketType.eventId, ticketTypeId, quantity).catch((error: unknown) => {
          if (error instanceof Error && error.message === 'EVENT_UNAVAILABLE') throw new ConflictException('This event is not accepting reservations or has insufficient capacity');
          if (error instanceof Error && error.message === 'TICKET_UNAVAILABLE') throw new ConflictException('This ticket type is unavailable or has insufficient inventory');
          throw error;
        });
        const totalAmount = snapshot.price.mul(quantity);
        if (!totalAmount.greaterThan(0) || totalAmount.greaterThan('9999999999.99')) {
          throw new BadRequestException('Registration total is outside the supported payment amount range');
        }
        const [{ now: createdAt }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS "now"`;
        const created = await tx.registration.create({
          data: {
            quantity,
            unitPrice: snapshot.price,
            totalAmount,
            currency: snapshot.currency,
            createdAt,
            idempotencyKey,
            attendee: { connect: { id: userId } },
            event: { connect: { id: ticketType.eventId } },
            ticketType: { connect: { id: ticketTypeId } },
            payments: {
              create: {
                merchantReference: `EVT-${randomUUID()}`,
                amount: totalAmount,
                currency: snapshot.currency,
                status: 'INITIATED',
              },
            },
          },
        });
        // Use one PostgreSQL clock value for both timestamps; client generated defaults can differ by milliseconds.
        await tx.$executeRaw`
          INSERT INTO "InventoryReservation" ("id", "registrationId", "eventId", "ticketTypeId", "quantity", "createdAt", "expiresAt", "updatedAt")
          VALUES (${randomUUID()}, ${created.id}, ${ticketType.eventId}, ${ticketTypeId}, ${quantity}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '10 minutes', CURRENT_TIMESTAMP)
        `;
        return tx.registration.findUniqueOrThrow({ where: { id: created.id }, include: registrationInclude });
      });
      return formatRegistration(registration);
    } catch (error) {
      // A concurrent request may have won the unique-key race; replay only if its payload matches.
      if (!isUniqueViolation(error) && !(error instanceof ConflictException)) throw error;
      const raced = await this.findByIdempotency(userId, idempotencyKey);
      if (!raced) {
        if (isUniqueViolation(error)) throw new ConflictException('A duplicate registration request was detected; retry with a new idempotency key');
        throw error;
      }
      return this.replay(raced, ticketTypeId, quantity);
    }
  }

  async listMine(userId: string) {
    const registrations = await this.prisma.registration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: registrationInclude,
    });
    return registrations.map(formatRegistration);
  }

  async getMine(userId: string, registrationId: string) {
    const registration = await this.prisma.registration.findFirst({
      where: { id: registrationId, userId },
      include: registrationInclude,
    });
    if (!registration) throw new NotFoundException('Registration not found');
    return formatRegistration(registration);
  }

  private findByIdempotency(userId: string, idempotencyKey: string) {
    return this.prisma.registration.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: registrationInclude,
    });
  }

  private replay(
    registration: NonNullable<Awaited<ReturnType<RegistrationsService['findByIdempotency']>>>,
    ticketTypeId: string,
    quantity: number,
  ) {
    if (registration.ticketTypeId !== ticketTypeId || registration.quantity !== quantity) {
      throw new ConflictException('This idempotency key was already used for a different registration request');
    }
    return formatRegistration(registration);
  }
}

function formatRegistration(registration: {
  id: string; quantity: number; unitPrice: Prisma.Decimal; totalAmount: Prisma.Decimal; currency: string;
  status: string; createdAt: Date;
  event: { id: string; title: string; venue: string; city: string; startAt: Date; endAt: Date; status: string };
  ticketType: { id: string; name: string };
  reservation: { status: string; expiresAt: Date } | null;
  payments: Array<{ id: string; status: string; amount: Prisma.Decimal; currency: string }>;
}) {
  return {
    id: registration.id,
    status: registration.status,
    quantity: registration.quantity,
    unitPrice: registration.unitPrice.toFixed(2),
    totalAmount: registration.totalAmount.toFixed(2),
    currency: registration.currency,
    createdAt: registration.createdAt,
    event: registration.event,
    ticketType: registration.ticketType,
    reservation: registration.reservation,
    payment: registration.payments[0]
      ? { id: registration.payments[0].id, status: registration.payments[0].status, amount: registration.payments[0].amount.toFixed(2), currency: registration.payments[0].currency }
      : null,
  };
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
