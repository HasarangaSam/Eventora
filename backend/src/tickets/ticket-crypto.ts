import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';

export function ticketQrToken(reference: string, config: ConfigService) {
  const secret = config.get<string>('TICKET_QR_SECRET')?.trim();
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new ServiceUnavailableException('Ticket QR signing is not configured; set TICKET_QR_SECRET to at least 32 characters');
  }
  return createHmac('sha256', secret).update(`eventora-ticket:${reference}`).digest('base64url');
}

export function ticketQrHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyTicketQr(reference: string, token: string, expectedHash: string, config: ConfigService) {
  const actual = ticketQrToken(reference, config);
  const actualHash = ticketQrHash(actual);
  return actualHash.length === expectedHash.length && timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash))
    && token.length === actual.length && timingSafeEqual(Buffer.from(actual), Buffer.from(token));
}
