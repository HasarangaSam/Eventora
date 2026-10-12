import { ConfigService } from '@nestjs/config';
import { ticketQrHash, ticketQrToken, verifyTicketQr } from './ticket-crypto.js';

describe('ticket QR tokens', () => {
  const config = new ConfigService({ TICKET_QR_SECRET: 'a-stable-test-secret-with-at-least-32-bytes' });

  it('derives an unguessable token from its public ticket reference and verifies its stored hash', () => {
    const reference = 'EVT-0123456789ABCDEF01234567';
    const token = ticketQrToken(reference, config);
    expect(token).toHaveLength(43);
    expect(ticketQrToken(reference, config)).toBe(token);
    expect(verifyTicketQr(reference, token, ticketQrHash(token), config)).toBe(true);
    expect(verifyTicketQr(reference, `${token}x`, ticketQrHash(token), config)).toBe(false);
    expect(ticketQrToken('EVT-0123456789ABCDEF01234568', config)).not.toBe(token);
  });
});
