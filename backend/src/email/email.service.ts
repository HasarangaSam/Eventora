import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import nodemailer, { type Transporter } from 'nodemailer';
import QRCode from 'qrcode';
import { ticketQrToken } from '../tickets/ticket-crypto.js';

const purchaseInclude = {
  attendee: { select: { email: true, firstName: true, lastName: true } },
  event: { select: { title: true, startAt: true, venue: true, city: true } },
  ticketType: { select: { name: true } },
  tickets: { orderBy: { createdAt: 'asc' as const } },
} as const;

type PurchaseRegistration = Prisma.RegistrationGetPayload<{ include: typeof purchaseInclude }>;

@Injectable()
export class EmailService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | undefined;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  onModuleDestroy() {
    this.transporter?.close();
  }

  // Called after payment commits. Email failure is logged and must not make PayHere retry a paid order.
  async sendPurchaseConfirmation(registrationId: string): Promise<void> {
    try {
      const registration = await this.prisma.registration.findUnique({
        where: { id: registrationId },
        include: purchaseInclude,
      });
      if (!registration || registration.status !== 'CONFIRMED' || registration.tickets.length === 0) {
        throw new Error('CONFIRMED_TICKETS_NOT_FOUND');
      }
      if (registration.tickets.length !== registration.quantity) {
        throw new Error('TICKET_COUNT_MISMATCH');
      }

      const message = await this.buildPurchaseMessage(registration);
      await this.getTransporter().sendMail({
        from: this.fromAddress(),
        to: registration.attendee.email,
        subject: cleanHeader(message.subject),
        // A stable message ID can help mail clients recognize a retried webhook delivery.
        messageId: `<eventora-${createMessageId(registration.id)}@eventora.local>`,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      });
    } catch (error) {
      // SMTP is a best-effort side effect now; never turn a committed payment into a failed webhook.
      const reason = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
      this.logger.warn(`Purchase confirmation for ${registrationId} was not sent (${reason}).`);
    }
  }

  private async buildPurchaseMessage(registration: PurchaseRegistration) {
    const frontendOrigin = this.config.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173').replace(/\/$/, '');
    const greeting = safeName(`${registration.attendee.firstName ?? ''} ${registration.attendee.lastName ?? ''}`) || 'there';
    const tickets = await Promise.all(registration.tickets.map(async (ticket) => {
      const token = ticketQrToken(ticket.reference, this.config);
      const cid = `eventora-ticket-${ticket.id}@eventora.local`;
      return {
        reference: ticket.reference,
        cid,
        attachment: {
          filename: `${ticket.reference}.png`,
          content: await QRCode.toBuffer(token, { type: 'png', errorCorrectionLevel: 'M', margin: 2, width: 256 }),
          contentType: 'image/png',
          cid,
        },
      };
    }));
    const event = registration.event;
    const ticketList = tickets.map((ticket, index) => `Ticket ${index + 1}: ${ticket.reference}`).join('\n');
    const text = [
      `Hi ${greeting},`,
      '',
      `Your payment for ${event.title} is confirmed. ${tickets.length} ${tickets.length === 1 ? 'ticket is' : 'tickets are'} ready to use.`,
      '',
      ticketList,
      '',
      `When: ${formatDateText(event.startAt)}`,
      `Where: ${event.venue}, ${event.city}`,
      `Ticket type: ${registration.ticketType.name}`,
      '',
      `View your tickets: ${frontendOrigin}/tickets`,
      'Keep the attached QR codes private.',
    ].join('\n');
    const rows = tickets.map((ticket, index) => `
      <tr><td style="padding:12px;border:1px solid #ddd;">
        <strong>Ticket ${index + 1}: ${escapeHtml(ticket.reference)}</strong>
        <img src="cid:${escapeHtml(ticket.cid)}" alt="Ticket QR code" width="160" height="160" />
      </td></tr>`).join('');
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172033;">
      <h1>Payment confirmed</h1>
      <p>Hi ${escapeHtml(greeting)}, your payment for <strong>${escapeHtml(event.title)}</strong> is confirmed.</p>
      <p>${escapeHtml(formatDateText(event.startAt))}<br />${escapeHtml(event.venue)}, ${escapeHtml(event.city)}</p>
      <p>Ticket type: ${escapeHtml(registration.ticketType.name)}</p>
      <table>${rows}</table>
      <p><a href="${escapeHtml(frontendOrigin)}/tickets">View your tickets</a></p>
      <p>Keep your QR codes private.</p>
    </body></html>`;

    return {
      subject: `Payment confirmed: ${event.title}`,
      text,
      html,
      attachments: tickets.map(({ attachment }) => attachment),
    };
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;
    const user = this.config.get<string>('GMAIL_USER')?.trim();
    const password = this.config.get<string>('GMAIL_APP_PASSWORD')?.replace(/\s/g, '');
    if (!user || !password || password.length !== 16) {
      throw new Error('EMAIL_CONFIGURATION_MISSING');
    }
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 60_000,
      auth: { user, pass: password },
    });
    return this.transporter;
  }

  private fromAddress() {
    const from = this.config.get<string>('EMAIL_FROM')?.trim();
    if (!from) throw new Error('EMAIL_FROM_MISSING');
    return from;
  }
}

function safeName(value: string) { return value.replace(/[<>\r\n]/g, '').trim().slice(0, 120); }
function cleanHeader(value: string) { return value.replace(/[\r\n]/g, ' ').slice(0, 200); }
function createMessageId(value: string) { return createHash('sha256').update(value).digest('hex'); }
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function formatDateText(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}
