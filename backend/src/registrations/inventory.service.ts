import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type DueReservation = { id: string; eventId: string; ticketTypeId: string; quantity: number };
type LockedReservation = DueReservation & { registrationId: string };

@Injectable()
export class InventoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventoryService.name);
  private expiryTimer: NodeJS.Timeout | undefined;
  private expiryBatch: Promise<number> | undefined;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.expiryTimer = setInterval(() => {
      void this.expireDueReservations().catch(() => this.logger.error('Reservation expiry batch failed'));
    }, 60_000);
    this.expiryTimer.unref();
    void this.expireDueReservations().catch(() => this.logger.error('Initial reservation expiry batch failed'));
  }

  onModuleDestroy() {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  async reserve(tx: Prisma.TransactionClient, eventId: string, ticketTypeId: string, quantity: number) {
    // Lock/update the event first so reservations and cancellation serialize on the same row.
    const eventRows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "Event"
      SET "ticketsReserved" = "ticketsReserved" + ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${eventId}
        AND "status" = 'PUBLISHED'
        AND "startAt" > CURRENT_TIMESTAMP
        AND "endAt" > CURRENT_TIMESTAMP
        AND ("capacity" IS NULL OR "ticketsReserved" + "ticketsSold" + ${quantity} <= "capacity")
      RETURNING "id"
    `;
    if (!eventRows.length) throw new Error('EVENT_UNAVAILABLE');

    // PostgreSQL evaluates the guarded update against the latest row after a concurrent writer releases its lock.
    const ticketRows = await tx.$queryRaw<Array<{ price: Prisma.Decimal; currency: string }>>`
      UPDATE "TicketType"
      SET "quantityReserved" = "quantityReserved" + ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${ticketTypeId}
        AND "eventId" = ${eventId}
        AND "isActive" = TRUE
        AND "price" > 0
        AND "quantityReserved" + "quantitySold" + ${quantity} <= "quantity"
        AND ("salesStartAt" IS NULL OR "salesStartAt" <= CURRENT_TIMESTAMP)
        AND ("salesEndAt" IS NULL OR "salesEndAt" > CURRENT_TIMESTAMP)
      RETURNING "price", "currency"
    `;
    if (!ticketRows.length) throw new Error('TICKET_UNAVAILABLE');
    return ticketRows[0];
  }

  async releaseEventReservations(tx: Prisma.TransactionClient, eventId: string): Promise<number> {
    const snapshots = await tx.inventoryReservation.findMany({
      where: { eventId, status: 'HELD' },
      select: { id: true, ticketTypeId: true },
    });
    if (!snapshots.length) return 0;

    const ids = snapshots.map(({ id }) => id);
    for (const ticketTypeId of [...new Set(snapshots.map(({ ticketTypeId }) => ticketTypeId))].sort((a, b) => a.localeCompare(b))) {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "TicketType" WHERE "id" = ${ticketTypeId} FOR UPDATE`;
    }
    const rows = await tx.$queryRaw<LockedReservation[]>`
      SELECT "id", "eventId", "ticketTypeId", "registrationId", "quantity"
      FROM "InventoryReservation"
      WHERE "id" IN (${Prisma.join(ids)}) AND "eventId" = ${eventId} AND "status" = 'HELD'
      ORDER BY "ticketTypeId", "id"
      FOR UPDATE
    `;
    return this.releaseLockedReservations(tx, rows, 'RELEASED');
  }

  async expireDueReservations(batchSize = 100, eventId?: string): Promise<number> {
    // Coalesce overlapping timer/request work in this process; row locks still coordinate separate app instances.
    if (this.expiryBatch) return this.expiryBatch;
    this.expiryBatch = this.runExpiryBatch(batchSize, eventId);
    try {
      return await this.expiryBatch;
    } finally {
      this.expiryBatch = undefined;
    }
  }

  private async runExpiryBatch(batchSize: number, eventId?: string) {
    const due = eventId
      ? await this.prisma.$queryRaw<DueReservation[]>`
        SELECT "id", "eventId", "ticketTypeId", "quantity"
        FROM "InventoryReservation"
        WHERE "status" = 'HELD' AND "expiresAt" <= CURRENT_TIMESTAMP AND "eventId" = ${eventId}
        ORDER BY "expiresAt", "id"
        LIMIT ${batchSize}
      `
      : await this.prisma.$queryRaw<DueReservation[]>`
        SELECT "id", "eventId", "ticketTypeId", "quantity"
        FROM "InventoryReservation"
        WHERE "status" = 'HELD' AND "expiresAt" <= CURRENT_TIMESTAMP
        ORDER BY "expiresAt", "id"
        LIMIT ${batchSize}
      `;
    let expired = 0;
    for (const reservation of due) {
      if (await this.expireOne(reservation)) expired++;
    }
    return expired;
  }

  private expireOne(candidate: DueReservation) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Event" WHERE "id" = ${candidate.eventId} FOR UPDATE`;
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "TicketType" WHERE "id" = ${candidate.ticketTypeId} FOR UPDATE`;
      const rows = await tx.$queryRaw<LockedReservation[]>`
        SELECT "id", "eventId", "ticketTypeId", "registrationId", "quantity"
        FROM "InventoryReservation"
        WHERE "id" = ${candidate.id} AND "status" = 'HELD' AND "expiresAt" <= CURRENT_TIMESTAMP
        FOR UPDATE
      `;
      return (await this.releaseLockedReservations(tx, rows, 'EXPIRED')) > 0;
    });
  }

  private async releaseLockedReservations(
    tx: Prisma.TransactionClient,
    reservations: LockedReservation[],
    status: 'EXPIRED' | 'RELEASED',
  ): Promise<number> {
    if (!reservations.length) return 0;

    // Aggregate before decrementing so counters are updated once per locked event/ticket type.
    const quantitiesByTicket = new Map<string, number>();
    const quantitiesByEvent = new Map<string, number>();
    const eventIds = new Set<string>();
    for (const reservation of reservations) {
      quantitiesByTicket.set(reservation.ticketTypeId, (quantitiesByTicket.get(reservation.ticketTypeId) ?? 0) + reservation.quantity);
      quantitiesByEvent.set(reservation.eventId, (quantitiesByEvent.get(reservation.eventId) ?? 0) + reservation.quantity);
      eventIds.add(reservation.eventId);
    }

    // Event and ticket rows are already locked before the reservation rows, matching the purchase path.
    for (const eventId of [...eventIds].sort()) {
      const eventUpdate = await tx.event.updateMany({
        where: { id: eventId, ticketsReserved: { gte: quantitiesByEvent.get(eventId)! } },
        data: { ticketsReserved: { decrement: quantitiesByEvent.get(eventId)! } },
      });
      if (eventUpdate.count !== 1) throw new Error('EVENT_RESERVATION_COUNTER_MISMATCH');
    }
    for (const [ticketTypeId, quantity] of quantitiesByTicket) {
      const ticketUpdate = await tx.ticketType.updateMany({
        where: { id: ticketTypeId, quantityReserved: { gte: quantity } },
        data: { quantityReserved: { decrement: quantity } },
      });
      if (ticketUpdate.count !== 1) throw new Error('TICKET_RESERVATION_COUNTER_MISMATCH');
    }

    const releasedAt = new Date();
    const reservationUpdate = await tx.inventoryReservation.updateMany({
      where: { id: { in: reservations.map(({ id }) => id) }, status: 'HELD' },
      data: { status, releasedAt },
    });
    if (reservationUpdate.count !== reservations.length) throw new Error('RESERVATION_STATE_CHANGED');

    const registrationIds = reservations.map(({ registrationId }) => registrationId);
    await tx.registration.updateMany({
      where: { id: { in: registrationIds }, status: 'PENDING' },
      data: { status: 'EXPIRED', expiredAt: releasedAt },
    });
    await tx.paymentAttempt.updateMany({
      where: { registrationId: { in: registrationIds }, status: { in: ['INITIATED', 'PENDING'] } },
      data: { status: 'EXPIRED' },
    });
    return reservations.length;
  }
}
