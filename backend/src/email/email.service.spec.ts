import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';

describe('purchase confirmation email', () => {
  it('does not fail the caller when email or QR configuration is missing', async () => {
    const prisma = {
      registration: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'registration-1', status: 'CONFIRMED', quantity: 1,
          attendee: { email: 'attendee@example.test', firstName: 'Test', lastName: 'User' },
          event: { title: 'Community Forum', startAt: new Date('2030-01-02T12:00:00Z'), venue: 'Hall', city: 'Colombo' },
          ticketType: { name: 'General' },
          tickets: [{ id: 'ticket-1', reference: 'EVT-123', createdAt: new Date() }],
        }),
      },
    };
    const service = new EmailService(prisma as never, new ConfigService({}));

    await expect(service.sendPurchaseConfirmation('registration-1')).resolves.toBeUndefined();
    expect(prisma.registration.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'registration-1' } }));
  });
});
