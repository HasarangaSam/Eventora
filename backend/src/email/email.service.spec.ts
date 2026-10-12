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
});
