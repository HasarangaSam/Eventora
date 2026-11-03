import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import QRCode from 'qrcode';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ticketQrToken, verifyTicketQr } from './ticket-crypto.js';

const ticketInclude = {
  event: { select: { id: true, slug: true, title: true, startAt: true, endAt: true, venue: true, city: true, timezone: true, coverImageUrl: true, status: true, cancellationReason: true } },
  ticketType: { select: { name: true } },
  registration: { select: { id: true, status: true } },
} as const;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async listMine(userId: string, query: { page: number; pageSize: number; search?: string; view: 'UPCOMING' | 'PAST' | 'CANCELLED' | 'ALL' }) {
    const now = new Date();
    const eventWhere = query.view === 'CANCELLED' ? { status: 'CANCELLED' as const }
      : query.view === 'PAST' ? { status: { not: 'CANCELLED' as const }, endAt: { lt: now } }
        : query.view === 'UPCOMING' ? { status: { not: 'CANCELLED' as const }, endAt: { gte: now } } : {};
    const where = {
      registration: { userId, status: 'CONFIRMED' as const },
      ...(Object.keys(eventWhere).length ? { event: eventWhere } : {}),
      ...(query.search?.trim() ? { event: { ...eventWhere, title: { contains: query.search.trim(), mode: 'insensitive' as const } } } : {}),
    };
    const [rows, total] = await Promise.all([this.prisma.ticket.findMany({
      where, orderBy: [{ event: { startAt: query.view === 'PAST' ? 'desc' : 'asc' } }, { createdAt: 'asc' }],
      skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: ticketInclude,
    }), this.prisma.ticket.count({ where })]);
    const items = rows.map((ticket) => ({
      id: ticket.id,
      reference: ticket.reference,
      status: ticket.status,
      issuedAt: ticket.issuedAt,
      registrationId: ticket.registration.id,
      event: ticket.event,
      ticketType: ticket.ticketType,
    }));
    return { items, total, page: query.page, pageSize: query.pageSize, pageCount: Math.ceil(total / query.pageSize) };
  }

  async getMine(userId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, registration: { userId } }, include: ticketInclude });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.present(ticket);
  }

  private async present(ticket: Prisma.TicketGetPayload<{ include: typeof ticketInclude }>) {
    if (ticket.registration.status !== 'CONFIRMED') {
      throw new NotFoundException('Ticket not found');
    }
    if (ticket.status !== 'ISSUED' || ticket.event.status !== 'PUBLISHED' || ticket.event.endAt <= new Date()) {
      throw new GoneException('This QR pass is no longer valid for entry');
    }
    // Recreate the signed QR token from its reference; only the token hash is stored in the database.
    const qrToken = ticketQrToken(ticket.reference, this.config);
    if (!verifyTicketQr(ticket.reference, qrToken, ticket.qrTokenHash, this.config)) throw new NotFoundException('Ticket not found');
    const qrCode = await QRCode.toDataURL(qrToken, { errorCorrectionLevel: 'M', margin: 2, width: 256 });
    return {
      id: ticket.id,
      reference: ticket.reference,
      status: ticket.status,
      issuedAt: ticket.issuedAt,
      qrCode,
      event: ticket.event,
      ticketType: ticket.ticketType,
    };
  }
}
