import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import nodemailer, { type Transporter } from 'nodemailer';
import QRCode from 'qrcode';
import { ticketQrToken } from '../tickets/ticket-crypto.js';

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;
const deliveryInclude = {
  registration: { include: { attendee: { select: { firstName: true, lastName: true } }, event: { select: { title: true, startAt: true, venue: true, city: true } }, ticketType: { select: { name: true } }, tickets: { orderBy: { createdAt: 'asc' as const } } } },
  organizerApplication: { include: { applicant: { select: { firstName: true, lastName: true } } } },
  event: { select: { title: true, startAt: true, venue: true, city: true } },
} as const;

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private timer: NodeJS.Timeout | undefined;
  private transporter: Transporter | undefined;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processDue().catch(() => this.logger.warn('Email outbox poll failed; it will retry on the next interval.')), 30_000);
    this.timer.unref();
    void this.processDue().catch(() => this.logger.warn('Email outbox startup poll failed; it will retry on the next interval.'));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.transporter?.close();
  }

  async processDue() {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.claimBatch();
      for (const row of rows) await this.sendDelivery(row.id, row.attemptCount);
    } finally {
      this.running = false;
    }
  }

  private async claimBatch() {
    return this.prisma.$transaction(async (tx) => {
      return tx.$queryRaw<Array<{ id: string; attemptCount: number }>>`
        WITH due AS (
          SELECT "id" FROM "EmailDelivery"
          WHERE "status" = 'PENDING' AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= CURRENT_TIMESTAMP)
          ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT ${BATCH_SIZE}
        )
        UPDATE "EmailDelivery" AS delivery
        SET "attemptCount" = delivery."attemptCount" + 1,
            "nextAttemptAt" = CURRENT_TIMESTAMP + interval '15 minutes',
            "updatedAt" = CURRENT_TIMESTAMP
        FROM due WHERE delivery."id" = due."id"
        RETURNING delivery."id", delivery."attemptCount"
      `;
    });
  }

  private async sendDelivery(id: string, attemptCount: number) {
    try {
      const delivery = await this.prisma.emailDelivery.findUnique({
        where: { id },
        include: deliveryInclude,
      });
      if (!delivery) return;
      const message = await this.render(delivery);
      await this.getTransporter().sendMail({
        from: this.fromAddress(),
        to: delivery.recipient,
        subject: cleanHeader(message.subject),
        messageId: `<eventora-${createMessageId(delivery.idempotencyKey)}@eventora.local>`,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      });
      await this.prisma.emailDelivery.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), nextAttemptAt: null, lastError: null } });
    } catch (error) {
      const terminal = attemptCount >= MAX_ATTEMPTS;
      const seconds = Math.min(60 * 60, 30 * 2 ** Math.max(0, attemptCount - 1));
      const safeError = safeFailureCode(error);
      await this.prisma.emailDelivery.update({
        where: { id },
        data: { status: terminal ? 'FAILED' : 'PENDING', nextAttemptAt: terminal ? null : new Date(Date.now() + seconds * 1000), lastError: safeError },
      }).catch(() => undefined);
      this.logger.warn(`Email delivery ${id} ${terminal ? 'failed permanently' : `will retry in ${seconds}s`} (${safeError}).`);
    }
  }

  private async render(delivery: Prisma.EmailDeliveryGetPayload<{ include: typeof deliveryInclude }>) {
    if (delivery.type === 'PURCHASE_CONFIRMATION') {
      if (!delivery.registration || delivery.registration.tickets.length === 0) throw new Error('TICKETS_NOT_READY');
      const registration = delivery.registration;
      const greeting = safeName(`${registration.attendee.firstName ?? ''} ${registration.attendee.lastName ?? ''}`) || 'there';
      const tickets = registration.tickets.map((ticket) => ({
        reference: ticket.reference,
        token: ticketQrToken(ticket.reference, this.config),
        cid: `eventora-ticket-${ticket.id}@eventora.local`,
      }));
      const attachments = await Promise.all(tickets.map(async (ticket) => ({
        filename: `${ticket.reference}.png`,
        content: await QRCode.toBuffer(ticket.token, { type: 'png', errorCorrectionLevel: 'M', margin: 2, width: 256 }),
        contentType: 'image/png',
        cid: ticket.cid,
      })));
      const url = this.ticketUrl();
      const text = `Hi ${greeting},\n\nYour payment for ${registration.event.title} is confirmed. ${tickets.length} ${tickets.length === 1 ? 'ticket is' : 'tickets are'} ready. The private QR code for each ticket is attached.\n\n${tickets.map((ticket, index) => `Ticket ${index + 1}: ${ticket.reference}`).join('\n')}\n\nView your tickets: ${url}\nEvent: ${registration.event.title}\nWhen: ${registration.event.startAt.toISOString()}\nWhere: ${registration.event.venue}, ${registration.event.city}\n\nKeep the attached QR codes private. Eventora support will never ask you to share them.`;
      const html = `<p>Hi ${escapeHtml(greeting)},</p><p>Your payment for <strong>${escapeHtml(registration.event.title)}</strong> is confirmed. Your ${tickets.length === 1 ? 'ticket is' : 'tickets are'} ready.</p><ul>${tickets.map((ticket, index) => `<li>Ticket ${index + 1}: <strong>${escapeHtml(ticket.reference)}</strong><br><img src="cid:${escapeHtml(ticket.cid)}" alt="QR code for ticket ${escapeHtml(ticket.reference)}" width="256" height="256"></li>`).join('')}</ul><p><a href="${escapeHtml(url)}">View your tickets</a></p><p>${escapeHtml(registration.event.startAt.toISOString())}<br>${escapeHtml(registration.event.venue)}, ${escapeHtml(registration.event.city)}</p><p>Keep the attached QR codes private. Eventora support will never ask you to share them.</p>`;
      return { subject: `Your Eventora tickets: ${registration.event.title}`, text, html, attachments };
    }
    if (delivery.type === 'ORGANIZER_APPLICATION_DECISION') {
      const application = delivery.organizerApplication;
      if (!application || application.status === 'PENDING') throw new Error('APPLICATION_DECISION_NOT_READY');
      const greeting = safeName(`${application.applicant.firstName ?? ''} ${application.applicant.lastName ?? ''}`) || 'there';
      const approved = application.status === 'APPROVED';
      const status = approved ? 'approved' : 'not approved';
      const text = `Hi ${greeting},\n\nYour organizer application for ${application.organizationName} was ${status}.${application.decisionNote ? `\n\nNote: ${application.decisionNote}` : ''}\n\nSign in to Eventora to view your account.`;
      return { subject: `Eventora organizer application ${status}`, text, html: `<p>Hi ${escapeHtml(greeting)},</p><p>Your organizer application for <strong>${escapeHtml(application.organizationName)}</strong> was ${status}.</p>${application.decisionNote ? `<p>Note: ${escapeHtml(application.decisionNote)}</p>` : ''}<p>Sign in to Eventora to view your account.</p>`, attachments: [] };
    }
    if (delivery.type === 'EVENT_CANCELLATION') {
      const registration = delivery.registration;
      const event = delivery.event ?? registration?.event;
      if (!event) throw new Error('CANCELLATION_EVENT_NOT_FOUND');
      const greeting = safeName(`${registration?.attendee.firstName ?? ''} ${registration?.attendee.lastName ?? ''}`) || 'there';
      const text = `Hi ${greeting},\n\n${event.title} has been cancelled by the organizer. Your Eventora ticket and payment history remain available in your account. Eventora has not issued an automatic refund. Please contact the event organizer for questions about next steps.`;
      return { subject: `Event cancelled: ${event.title}`, text, html: `<p>Hi ${escapeHtml(greeting)},</p><p><strong>${escapeHtml(event.title)}</strong> has been cancelled by the organizer.</p><p>Your Eventora ticket and payment history remain available in your account. Eventora has not issued an automatic refund. Please contact the event organizer for questions about next steps.</p>`, attachments: [] };
    }
    throw new Error('UNSUPPORTED_EMAIL_TYPE');
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;
    const user = this.config.get<string>('GMAIL_USER')?.trim();
    const password = this.config.get<string>('GMAIL_APP_PASSWORD')?.replace(/\s/g, '');
    if (!user || !password || user.length > 320 || password.length !== 16) {
      throw new ServiceUnavailableException('Gmail delivery is not configured; set GMAIL_USER and a 16-character GMAIL_APP_PASSWORD');
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
    if (!from) throw new ServiceUnavailableException('EMAIL_FROM is not configured');
    return from;
  }

  private ticketUrl() {
    const origin = this.config.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173').replace(/\/$/, '');
    return `${origin}/tickets`;
  }
}

function safeFailureCode(error: unknown) {
  if (error instanceof ServiceUnavailableException) return 'EMAIL_CONFIGURATION_MISSING';
  if (error instanceof Error && /TICKETS_NOT_READY|APPLICATION_DECISION_NOT_READY|CANCELLATION_EVENT_NOT_FOUND|UNSUPPORTED_EMAIL_TYPE/.test(error.message)) return error.message;
  return 'SMTP_DELIVERY_FAILED';
}

function safeName(value: string) { return value.replace(/[<>\r\n]/g, '').trim().slice(0, 120); }
function cleanHeader(value: string) { return value.replace(/[\r\n]/g, ' ').slice(0, 200); }
function createMessageId(value: string) { return createHash('sha256').update(value).digest('hex'); }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!); }
