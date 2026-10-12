import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';

describe('email outbox retry handling', () => {
  function setup(attemptCount: number) {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: 'mail-1', attemptCount }]) };
    const prisma = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
      emailDelivery: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'mail-1', type: 'ORGANIZER_APPLICATION_DECISION',
          organizerApplication: { status: 'APPROVED', organizationName: 'Local Society', decisionNote: null, applicant: { firstName: 'Test', lastName: 'User' } },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new EmailService(prisma as never, new ConfigService({}));
    return { service, prisma };
  }

  it('schedules retry with a non-sensitive failure code when Gmail configuration is missing', async () => {
    const { service, prisma } = setup(1);
    await service.processDue();
    expect(prisma.emailDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'mail-1' },
      data: expect.objectContaining({ status: 'PENDING', lastError: 'EMAIL_CONFIGURATION_MISSING', nextAttemptAt: expect.any(Date) }),
    }));
  });

  it('marks a delivery failed after the fifth unsuccessful attempt', async () => {
    const { service, prisma } = setup(5);
    await service.processDue();
    expect(prisma.emailDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'mail-1' },
      data: { status: 'FAILED', nextAttemptAt: null, lastError: 'EMAIL_CONFIGURATION_MISSING' },
    }));
  });

  it('describes administrator cancellations accurately and safely includes their reason', async () => {
    const { service } = setup(1);
    const render = (service as unknown as { render: (delivery: object) => Promise<{ text: string; html: string }> }).render.bind(service);
    const message = await render({
      type: 'EVENT_CANCELLATION',
      registration: { attendee: { firstName: 'Test', lastName: 'User' } },
      event: { title: 'Community Forum', cancelledBy: { role: 'ADMIN' }, cancellationReason: 'Safety <issue>' },
    });
    expect(message.text).toContain('cancelled by an Eventora administrator');
    expect(message.text).toContain('Reason: Safety <issue>');
    expect(message.html).toContain('Reason: Safety &lt;issue&gt;');
  });
});
