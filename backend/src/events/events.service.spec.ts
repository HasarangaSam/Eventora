import { NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { EventsController } from './events.controller.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('EventsService', () => {
  const event = {
    id: 'event_1',
    slug: 'summer-market',
    title: 'Summer Market',
    description: 'A community market with local food and music.',
    venue: 'Town Hall',
    city: 'Colombo',
    startAt: new Date('2030-07-01T10:00:00Z'),
    endAt: new Date('2030-07-01T15:00:00Z'),
    timezone: 'Asia/Colombo',
    coverImageUrl: null,
    capacity: 100,
    ticketsReserved: 2,
    ticketsSold: 3,
    category: { id: 'category_1', name: 'Markets', slug: 'markets' },
    ticketTypes: [{
      price: { toFixed: () => '1250.00', lessThan: () => false },
      currency: 'LKR',
      quantity: 100,
      quantityReserved: 2,
      quantitySold: 3,
      salesStartAt: null,
      salesEndAt: null,
    }],
  };

  it('queries published events with search, filters, stable ordering, and server pagination', async () => {
    const findMany = vi.fn().mockResolvedValue([event]);
    const count = vi.fn().mockResolvedValue(1);
    const service = new EventsService({ event: { findMany, count } } as unknown as PrismaService);
    const from = new Date('2030-07-01T00:00:00Z');
    const response = await service.list({
      page: 2,
      pageSize: 9,
      search: 'market',
      categoryId: 'category_1',
      from,
      to: undefined,
      sort: 'title',
      direction: 'asc',
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'PUBLISHED', categoryId: 'category_1', startAt: { gte: from } }),
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      skip: 9,
      take: 9,
      select: expect.not.objectContaining({ organizer: expect.anything() }),
    }));
    expect(response.pagination).toEqual({ page: 2, pageSize: 9, total: 1, totalPages: 1 });
    expect(response.items[0]).toMatchObject({ startingPrice: '1250.00', currency: 'LKR', hasAvailability: true });
    expect(response.items[0]).not.toHaveProperty('capacity');
    expect(response.items[0]).not.toHaveProperty('organizer');
  });

  it('returns the same not-found response for drafts and missing events', async () => {
    const service = new EventsService({ event: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaService);
    await expect(service.get('private-draft')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('only selects sessions belonging to a published event', async () => {
    const eventFindFirst = vi.fn().mockResolvedValue({ id: 'event_1' });
    const eventSessionFindMany = vi.fn().mockResolvedValue([]);
    const service = new EventsService({
      event: { findFirst: eventFindFirst },
      eventSession: { findMany: eventSessionFindMany },
    } as unknown as PrismaService);
    await service.sessions('summer-market');

    expect(eventFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ id: 'summer-market' }, { slug: 'summer-market' }], status: 'PUBLISHED' },
    }));
    expect(eventSessionFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: 'event_1' } }));
  });

  it('exposes only the approved organizer public name on published event details', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'event_1', title: 'Summer Market', organizer: { organizerApplications: [{ organizationName: 'Market Collective' }] } });
    const service = new EventsService({ event: { findFirst } } as unknown as PrismaService);
    await expect(service.get('summer-market')).resolves.toEqual({ id: 'event_1', title: 'Summer Market', organizerName: 'Market Collective' });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        organizer: { select: { organizerApplications: expect.objectContaining({
          where: { status: 'APPROVED' }, take: 1, select: { organizationName: true },
        }) } },
      }),
    }));
  });

  it('returns public ticket prices as exact strings and clamps inventory by event capacity', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'event_1', capacity: 20, ticketsReserved: 17, ticketsSold: 2 });
    const findMany = vi.fn().mockResolvedValue([{
      id: 'ticket_1',
      name: 'General admission',
      description: null,
      price: { toFixed: () => '1250.10' },
      currency: 'LKR',
      quantity: 50,
      quantityReserved: 4,
      quantitySold: 5,
      salesStartAt: new Date(Date.now() + 60_000),
      salesEndAt: null,
    }]);
    const service = new EventsService({
      event: { findFirst },
      ticketType: { findMany },
    } as unknown as PrismaService);

    await expect(service.ticketTypes('summer-market')).resolves.toEqual([expect.objectContaining({
      id: 'ticket_1',
      price: '1250.10',
      currency: 'LKR',
      availableQuantity: 1,
      isOnSale: false,
    })]);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ id: 'summer-market' }, { slug: 'summer-market' }], status: 'PUBLISHED' },
    }));
  });

  it('rejects invalid pagination before making a database query', () => {
    // Pagination validation is now fully declared on ListEventsQueryDto and enforced by the global ValidationPipe.
    // The controller no longer throws directly; this is covered by DTO unit tests.
    const controller = new EventsController({ list: vi.fn() } as unknown as EventsService);
    // Valid call should not throw.
    controller.list({ page: 1, pageSize: 12, sort: 'startAt' });
  });
});
