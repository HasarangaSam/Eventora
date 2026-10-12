import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import QRCode from 'qrcode';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ticketQrToken, verifyTicketQr } from './ticket-crypto.js';

const ticketInclude = {
  event: { select: { id: true, title: true, startAt: true, endAt: true, venue: true, city: true, timezone: true, coverImageUrl: true, status: true } },
  ticketType: { select: { name: true } },
  registration: { select: { id: true, status: true } },
} as const;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async listMine(userId: string) {
    const rows = await this.prisma.ticket.findMany({
      where: { registration: { userId } },
      orderBy: [{ event: { startAt: 'asc' } }, { createdAt: 'asc' }],
      take: 100,
      include: ticketInclude,
    });
    return rows.filter((ticket) => ticket.registration.status === 'CONFIRMED').map((ticket) => ({
      id: ticket.id,
      reference: ticket.reference,
      status: ticket.status,
      issuedAt: ticket.issuedAt,
      event: ticket.event,
      ticketType: ticket.ticketType,
    }));
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
