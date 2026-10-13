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
  registration: { include: { attendee: { select: { firstName: true, lastName: true } }, event: { select: { title: true, startAt: true, venue: true, city: true, cancellationReason: true, cancelledBy: { select: { role: true } } } }, ticketType: { select: { name: true } }, tickets: { orderBy: { createdAt: 'asc' as const } } } },
  organizerApplication: { include: { applicant: { select: { firstName: true, lastName: true } } } },
  event: { select: { title: true, startAt: true, venue: true, city: true, cancellationReason: true, cancelledBy: { select: { role: true } } } },
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
    // Avoid overlapping polls in one process; SKIP LOCKED handles competition between processes.
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
      // Claim rows atomically and set a lease before sending so another worker skips this batch.
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
      // Store a sanitized code rather than provider response text, which may contain recipient or credential data.
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
    const frontendOrigin = this.config.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173').replace(/\/$/, '');

    /* ─────────────────────────────────────────────
       1. PURCHASE CONFIRMATION
    ───────────────────────────────────────────── */
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
      const ticketUrl = `${frontendOrigin}/tickets`;

      const text = [
        `Hi ${greeting},`,
        ``,
        `Your payment for ${registration.event.title} is confirmed. ${tickets.length} ${tickets.length === 1 ? 'ticket is' : 'tickets are'} ready to use.`,
        ``,
        tickets.map((t, i) => `Ticket ${i + 1}: ${t.reference}`).join('\n'),
        ``,
        `Event: ${registration.event.title}`,
        `When:  ${formatDateText(registration.event.startAt)}`,
        `Where: ${registration.event.venue}, ${registration.event.city}`,
        ``,
        `View your tickets: ${ticketUrl}`,
        ``,
        `Keep the attached QR codes private. Eventora support will never ask you to share them.`,
      ].join('\n');

      const ticketCards = tickets.map((ticket, i) => `
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="border:2px solid #6366f1;border-radius:14px;margin-bottom:16px;background:#ffffff;">
          <tr>
            <td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="vertical-align:middle;padding-right:20px;">
                    <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">
                      Ticket ${i + 1} of ${tickets.length}
                    </p>
                    <p style="margin:0 0 4px;font-size:18px;font-weight:800;color:#0f172a;font-family:Courier New,Courier,monospace;letter-spacing:1px;">
                      ${escapeHtml(ticket.reference)}
                    </p>
                    <p style="margin:0;font-size:13px;color:#64748b;">Scan this QR code at the door</p>
                  </td>
                  <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
                    <img src="cid:${escapeHtml(ticket.cid)}"
                         alt="QR code ${escapeHtml(ticket.reference)}"
                         width="110" height="110"
                         style="display:block;border-radius:8px;border:1px solid #e2e8f0;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`).join('');

      const html = buildEmail({
        previewText: `Payment confirmed for ${registration.event.title}.`,
        body: `
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;">Purchase Confirmed</p>
          <h1 style="margin:0 0 14px;font-size:28px;font-weight:800;color:#0f172a;line-height:1.2;">
            Payment confirmed
          </h1>
          <p style="margin:0 0 28px;font-size:16px;color:#475569;line-height:1.6;">
            Hi ${escapeHtml(greeting)}, your payment for <strong style="color:#0f172a;">${escapeHtml(registration.event.title)}</strong> is confirmed.
            ${tickets.length === 1 ? 'Your ticket is' : 'Your tickets are'} below.
          </p>

          <!-- Event detail card -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:28px;">
            <tr>
              <td style="padding:22px 26px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding-bottom:14px;" colspan="2">
                      <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Event</p>
                      <p style="margin:0;font-size:17px;font-weight:700;color:#0f172a;">${escapeHtml(registration.event.title)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" style="padding-bottom:10px;padding-right:16px;vertical-align:top;">
                      <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Date &amp; Time</p>
                      <p style="margin:0;font-size:14px;color:#334155;">${escapeHtml(formatDateText(registration.event.startAt))}</p>
                    </td>
                    <td width="50%" style="padding-bottom:10px;vertical-align:top;">
                      <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Venue</p>
                      <p style="margin:0;font-size:14px;color:#334155;">${escapeHtml(registration.event.venue)}, ${escapeHtml(registration.event.city)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2">
                      <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Ticket Type</p>
                      <p style="margin:0;font-size:14px;color:#334155;">${escapeHtml(registration.ticketType.name)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- QR ticket cards -->
          <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0f172a;">
            ${tickets.length === 1 ? 'Ticket' : `Tickets (${tickets.length})`}
          </p>
          ${ticketCards}

          <!-- Security note -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin:20px 0;">
            <tr>
              <td style="padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:#166534;line-height:1.5;">
                  <strong>Keep your QR codes private.</strong>
                  Anyone with a QR code may be able to use that ticket.
                </p>
              </td>
            </tr>
          </table>

          <!-- CTA button -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;">
            <tr>
              <td style="text-align:center;">
                <a href="${escapeHtml(ticketUrl)}"
                   style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;
                          font-size:15px;font-weight:700;padding:14px 34px;border-radius:10px;letter-spacing:0.3px;">
                  View tickets
                </a>
              </td>
            </tr>
          </table>
        `,
      });
      return { subject: `Payment confirmed: ${registration.event.title}`, text, html, attachments };
    }

    /* ─────────────────────────────────────────────
       2. ORGANIZER APPLICATION DECISION
    ───────────────────────────────────────────── */
    if (delivery.type === 'ORGANIZER_APPLICATION_DECISION') {
      const application = delivery.organizerApplication;
      if (!application || application.status === 'PENDING') throw new Error('APPLICATION_DECISION_NOT_READY');
      const greeting = safeName(`${application.applicant.firstName ?? ''} ${application.applicant.lastName ?? ''}`) || 'there';
      const approved = application.status === 'APPROVED';
      const statusLabel = approved ? 'Approved' : 'Not Approved';
      const accentColor = approved ? '#059669' : '#dc2626';
      const cardBg = approved ? '#ecfdf5' : '#fef2f2';
      const cardBorder = approved ? '#a7f3d0' : '#fecaca';
      const cardTextColor = approved ? '#065f46' : '#991b1b';
      const cardSubColor = approved ? '#047857' : '#b91c1c';

      const text = [
        `Hi ${greeting},`,
        ``,
        `Your organizer application for "${application.organizationName}" has been ${statusLabel.toLowerCase()}.`,
        application.decisionNote ? `\nNote from the team:\n${application.decisionNote}` : '',
        ``,
        approved
          ? `You can now sign in to Eventora and start creating and publishing events.\n\n${frontendOrigin}/organizer`
          : `You are welcome to submit a new application in the future.`,
      ].join('\n');

      const html = buildEmail({
        previewText: `Your Eventora organizer application for ${application.organizationName} has been reviewed.`,
        body: `
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${accentColor};">
            Application ${statusLabel}
          </p>
          <h1 style="margin:0 0 14px;font-size:28px;font-weight:800;color:#0f172a;line-height:1.2;">
            ${approved ? 'Application approved' : 'Application not approved'}
          </h1>
          <p style="margin:0 0 28px;font-size:16px;color:#475569;line-height:1.6;">
            Hi ${escapeHtml(greeting)}, we reviewed your organizer application for
            <strong style="color:#0f172a;">${escapeHtml(application.organizationName)}</strong>.
          </p>

          <!-- Status card -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="background:${cardBg};border:1px solid ${cardBorder};border-radius:14px;margin-bottom:24px;">
            <tr>
              <td style="padding:22px 26px;">
                <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:${cardTextColor};">
                  ${statusLabel}
                </p>
                <p style="margin:0;font-size:13px;color:${cardSubColor};">${escapeHtml(application.organizationName)}</p>
              </td>
            </tr>
          </table>

          ${application.decisionNote ? `
          <!-- Decision note -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="background:#f8fafc;border-left:4px solid #6366f1;border-radius:0 10px 10px 0;margin-bottom:24px;">
            <tr>
              <td style="padding:16px 20px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Note from the team</p>
                <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${escapeHtml(application.decisionNote)}</p>
              </td>
            </tr>
          </table>` : ''}

          ${approved ? `
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;">
            <tr>
              <td style="text-align:center;">
                <a href="${escapeHtml(frontendOrigin)}/organizer"
                   style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;
                          font-size:15px;font-weight:700;padding:14px 34px;border-radius:10px;">
                  Open Organizer Studio
                </a>
              </td>
            </tr>
          </table>` : `
          <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
            You may submit a new application in the future. Contact support if you have questions about this decision.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;">
            <tr>
              <td style="text-align:center;">
                <a href="${escapeHtml(frontendOrigin)}"
                   style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;
                          font-size:15px;font-weight:700;padding:14px 34px;border-radius:10px;">
                  Visit Eventora
                </a>
              </td>
            </tr>
          </table>`}
        `,
      });
      return { subject: `Eventora organizer application: ${statusLabel} — ${application.organizationName}`, text, html, attachments: [] };
    }

    /* ─────────────────────────────────────────────
       3. EVENT CANCELLATION
    ───────────────────────────────────────────── */
    if (delivery.type === 'EVENT_CANCELLATION') {
      const registration = delivery.registration;
      const event = delivery.event ?? registration?.event;
      if (!event) throw new Error('CANCELLATION_EVENT_NOT_FOUND');
      const greeting = safeName(`${registration?.attendee.firstName ?? ''} ${registration?.attendee.lastName ?? ''}`) || 'there';
      const cancelledBy = event.cancelledBy?.role === 'ADMIN' ? 'an Eventora administrator' : 'the event organizer';
      const reason = event.cancellationReason?.trim();

      const text = [
        `Hi ${greeting},`,
        ``,
        `${event.title} has been cancelled by ${cancelledBy}.`,
        reason ? `\nReason: ${reason}` : '',
        ``,
        `Your Eventora ticket and payment history remain available in your account.`,
        `No automatic refund has been issued. Contact the event organizer with questions about a refund.`,
        ``,
        `View your tickets: ${frontendOrigin}/tickets`,
      ].join('\n');

      const html = buildEmail({
        previewText: `${event.title} has been cancelled.`,
        body: `
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#dc2626;">
            Event Cancelled
          </p>
          <h1 style="margin:0 0 14px;font-size:28px;font-weight:800;color:#0f172a;line-height:1.2;">
            Event cancelled
          </h1>
          <p style="margin:0 0 28px;font-size:16px;color:#475569;line-height:1.6;">
            Hi ${escapeHtml(greeting)}, <strong style="color:#0f172a;">${escapeHtml(event.title)}</strong>
            has been cancelled by ${cancelledBy}.
          </p>

          <!-- Cancelled event card -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="background:#fef2f2;border:1px solid #fecaca;border-radius:14px;margin-bottom:24px;">
            <tr>
              <td style="padding:22px 26px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Cancelled Event</p>
                <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#7f1d1d;">${escapeHtml(event.title)}</p>
                <p style="margin:0;font-size:13px;color:#b91c1c;">
                  ${escapeHtml(formatDateText(event.startAt))} &nbsp;·&nbsp; ${escapeHtml(event.venue ?? 'TBA')}${event.city ? `, ${escapeHtml(event.city)}` : ''}
                </p>
              </td>
            </tr>
          </table>

          ${reason ? `
          <!-- Cancellation reason -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;margin-bottom:24px;">
            <tr>
              <td style="padding:16px 20px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Reason provided</p>
                <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">Reason: ${escapeHtml(reason)}</p>
              </td>
            </tr>
          </table>` : ''}

          <p style="margin:0 0 24px;font-size:14px;color:#334155;line-height:1.6;">
            Your ticket and payment history remain in your account. No automatic refund has been issued;
            contact the event organizer with refund questions.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;">
            <tr>
              <td style="text-align:center;">
                <a href="${escapeHtml(frontendOrigin)}/tickets"
                   style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;
                          font-size:15px;font-weight:700;padding:14px 28px;border-radius:10px;">
                  View tickets
                </a>
              </td>
            </tr>
          </table>
        `,
      });
      return { subject: `Event cancelled: ${event.title}`, text, html, attachments: [] };
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

/* ─────────────────────────────────────────────────────────────────────────────
   EMAIL SHELL BUILDER
   Produces a fully self-contained HTML email with a branded header,
   content body, and footer — all table-based and inline-styled for maximum
   email-client compatibility (Gmail, Outlook, Apple Mail, etc.).
───────────────────────────────────────────────────────────────────────────── */
function buildEmail({ previewText, body }: { previewText: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>Eventora</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;padding:0;word-break:break-word;-webkit-font-smoothing:antialiased;background-color:#f1f5f9}
    img{border:0;display:block;max-width:100%;height:auto}
    a{color:#6366f1}
    @media(max-width:600px){
      .email-wrapper{width:100%!important;min-width:100%!important}
      .email-body{padding:24px 16px!important}
      .btn-table td{text-align:center!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">

  <!-- Preview text (hidden) -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(previewText)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Email container -->
        <table class="email-wrapper" width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="width:600px;background:#ffffff;border-radius:20px;overflow:hidden;
                      box-shadow:0 4px 32px rgba(0,0,0,0.08);">

          <!-- ── Brand Header ── -->
          <tr>
            <td style="background:#6366f1;padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <p style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                      eventora<span style="color:#a5b4fc;">.</span>
                    </p>
                    <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:0.5px;">
                      Premium Events &amp; Ticketing
                    </p>
                  </td>
                  <td style="text-align:right;vertical-align:middle;">
                    <span style="display:inline-block;background:rgba(255,255,255,0.15);
                                 color:#ffffff;font-size:12px;font-weight:700;
                                 padding:5px 12px;border-radius:20px;letter-spacing:0.5px;">
                      Eventora
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body Content ── -->
          <tr>
            <td class="email-body" style="padding:36px 40px;">
              ${body}
            </td>
          </tr>

          <!-- ── Divider ── -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.5;text-align:center;">
                This email was sent by <strong style="color:#6366f1;">Eventora</strong> in relation to your account activity.
              </p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;text-align:center;">
                &copy; ${new Date().getFullYear()} Eventora. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   UTILITY FUNCTIONS
───────────────────────────────────────────────────────────────────────────── */
function safeFailureCode(error: unknown) {
  if (error instanceof ServiceUnavailableException) return 'EMAIL_CONFIGURATION_MISSING';
  if (error instanceof Error && /TICKETS_NOT_READY|APPLICATION_DECISION_NOT_READY|CANCELLATION_EVENT_NOT_FOUND|UNSUPPORTED_EMAIL_TYPE/.test(error.message)) return error.message;
  return 'SMTP_DELIVERY_FAILED';
}

function safeName(value: string) { return value.replace(/[<>\r\n]/g, '').trim().slice(0, 120); }
function cleanHeader(value: string) { return value.replace(/[\r\n]/g, ' ').slice(0, 200); }
function createMessageId(value: string) { return createHash('sha256').update(value).digest('hex'); }
function escapeHtml(value?: string | null): string {
  if (!value) return '';
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function formatDateText(date?: Date | string | null): string {
  if (!date) return 'TBA';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'TBA';
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}
