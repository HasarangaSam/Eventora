import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ticketQrHash, verifyTicketQr } from '../tickets/ticket-crypto.js';

export type CheckInMethod = 'QR_SCAN' | 'MANUAL_REFERENCE';

@Injectable()
export class CheckinsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async checkIn(organizerId: string, eventId: string, value: string, method: CheckInMethod, commit = true) {
    return this.prisma.$transaction(async (tx) => {
      const events = await tx.$queryRaw<Array<{ id: string; organizerId: string; status: string }>>(Prisma.sql`
        SELECT "id", "organizerId", "status" FROM "Event" WHERE "id" = ${eventId} FOR SHARE
      `);
      const event = events[0];
      if (!event || event.organizerId !== organizerId) throw new NotFoundException('Event not found');

      const candidate = method === 'QR_SCAN'
        ? await tx.ticket.findFirst({ where: { qrTokenHash: ticketQrHash(value) }, select: { id: true } })
        : await tx.ticket.findUnique({ where: { reference: value.trim().toUpperCase() }, select: { id: true } });
      if (!candidate) return { outcome: 'INVALID' as const };

      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "Ticket" WHERE "id" = ${candidate.id} FOR UPDATE
      `);
      if (!locked.length) return { outcome: 'INVALID' as const };

      const ticket = await tx.ticket.findUnique({
        where: { id: candidate.id },
        include: {
          registration: { select: { eventId: true, status: true, payments: { select: { status: true } } } },
          ticketType: { select: { name: true } },
          checkIn: { select: { checkedInAt: true } },
        },
      });
      if (!ticket) return { outcome: 'INVALID' as const };
      if (ticket.eventId !== eventId || ticket.registration.eventId !== eventId) return { outcome: 'WRONG_EVENT' as const };
      if (method === 'QR_SCAN' && !verifyTicketQr(ticket.reference, value, ticket.qrTokenHash, this.config)) return { outcome: 'INVALID' as const };
      if (ticket.status === 'VOIDED') return { outcome: 'INVALID' as const };
      if (ticket.status === 'CHECKED_IN' || ticket.checkIn) {
        return { outcome: 'ALREADY_CHECKED_IN' as const, checkedInAt: ticket.checkIn?.checkedInAt ?? null };
      }
      if (event.status === 'CANCELLED') return { outcome: 'EVENT_CANCELLED' as const };
      if (ticket.registration.status !== 'CONFIRMED' || !ticket.registration.payments.some((payment) => payment.status === 'SUCCEEDED')) {
        return { outcome: 'PAYMENT_UNCONFIRMED' as const };
      }
      if (!commit) return { outcome: 'VALID' as const, reference: ticket.reference, ticketType: ticket.ticketType.name };

      const checkIn = await tx.checkIn.create({
        data: { ticketId: ticket.id, eventId, checkedInById: organizerId, method },
        select: { checkedInAt: true },
      });
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: 'CHECKED_IN' } });
      return {
        outcome: 'CHECKED_IN' as const,
        reference: ticket.reference,
        ticketType: ticket.ticketType.name,
        checkedInAt: checkIn.checkedInAt,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async attendance(organizerId: string, eventId: string, page: number, pageSize: number) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, organizerId }, select: { id: true, title: true } });
    if (!event) throw new NotFoundException('Event not found');

    const where = { eventId };
    const [totalIssued, checkedIn, rows] = await Promise.all([
      this.prisma.ticket.count({ where: { eventId, status: { not: 'VOIDED' }, registration: { status: 'CONFIRMED' } } }),
      this.prisma.checkIn.count({ where }),
      this.prisma.checkIn.findMany({
        where,
        orderBy: [{ checkedInAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, checkedInAt: true, method: true, ticket: { select: { reference: true, ticketType: { select: { name: true } } } } },
      }),
    ]);
    return {
      event,
      summary: { totalIssued, checkedIn, remaining: Math.max(0, totalIssued - checkedIn) },
      page,
      pageSize,
      records: rows.map(({ ticket, ...checkIn }) => ({ ...checkIn, reference: ticket.reference, ticketType: ticket.ticketType.name })),
    };
  }
}
