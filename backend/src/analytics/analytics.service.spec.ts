import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('AnalyticsService', () => {
  it('limits organizer aggregates to owned events and verified successful payments', async () => {
    const groupBy = vi.fn(async ({ by }: { by: string[] }) => by[0] === 'status' ? [] : [{ currency: 'LKR', _sum: { amount: { toString: () => '2500.00' } }, _count: { _all: 2 } }]);
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      event: { groupBy, count, findMany }, registration: { count },
      paymentAttempt: { groupBy }, ticket: { count }, checkIn: { count }, organizerApplication: { count },
    } as unknown as PrismaService;
    const response = await new AnalyticsService(prisma).organizer('organizer_1');
    expect(response.grossSales).toEqual([{ currency: 'LKR', amount: '2500.00', payments: 2 }]);
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['currency'],
      where: expect.objectContaining({ status: 'SUCCEEDED', verifiedAt: { not: null }, registration: { event: { organizerId: 'organizer_1' } } }),
    }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizerId: 'organizer_1' }, take: 8 }));
  });

  it('does not return event analytics for an event outside the organizer scope', async () => {
    const service = new AnalyticsService({ event: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaService);
    await expect(service.organizerEvent('organizer_1', 'other_event')).rejects.toBeInstanceOf(NotFoundException);
  });
});
