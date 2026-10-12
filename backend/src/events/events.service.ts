import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  venue: true,
  city: true,
  startAt: true,
  endAt: true,
  timezone: true,
  coverImageUrl: true,
  capacity: true,
  ticketsReserved: true,
  ticketsSold: true,
  category: { select: { id: true, name: true, slug: true } },
  ticketTypes: {
    where: { isActive: true },
    select: {
      price: true,
      currency: true,
      quantity: true,
      quantityReserved: true,
      quantitySold: true,
      salesStartAt: true,
      salesEndAt: true,
    },
  },
} as const;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: EventFilters) {
    const where: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.from || filters.to
        ? { startAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : { endAt: { gte: new Date() } }),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
              { venue: { contains: filters.search, mode: 'insensitive' } },
              { city: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.EventOrderByWithRelationInput = filters.sort === 'title'
      ? { title: filters.direction }
      : filters.sort === 'newest'
        ? { createdAt: filters.direction }
        : { startAt: filters.direction };
    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        select: cardSelect,
      }),
      this.prisma.event.count({ where }),
    ]);

    const now = new Date();
    const items = events.map((event) => {
      const capacityRemaining = eventCapacityRemaining(event.capacity, event.ticketsReserved, event.ticketsSold);
      const tickets = event.ticketTypes
        .filter((ticket) => ticket.salesEndAt === null || ticket.salesEndAt >= now)
        .map((ticket) => ({
          price: ticket.price,
          currency: ticket.currency,
          salesStartAt: ticket.salesStartAt,
          availableQuantity: Math.max(0, Math.min(
            ticket.quantity - ticket.quantityReserved - ticket.quantitySold,
            capacityRemaining ?? Number.MAX_SAFE_INTEGER,
          )),
        }));
      const startingTicket = tickets.reduce<(typeof tickets)[number] | null>(
        (lowest, ticket) => !lowest || ticket.price.lessThan(lowest.price) ? ticket : lowest,
        null,
      );
      const { ticketTypes: _ticketTypes, capacity: _capacity, ticketsReserved: _reserved, ticketsSold: _sold, ...eventCard } = event;
      return {
        ...eventCard,
        description: event.description.slice(0, 240),
        startingPrice: startingTicket?.price.toFixed(2) ?? null,
        currency: startingTicket?.currency ?? null,
        hasAvailability: tickets.some((ticket) => ticket.availableQuantity > 0
          && (ticket.salesStartAt === null || ticket.salesStartAt <= now)),
      };
    });
    return {
      items,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    };
  }

  async featured(limit: number) {
    const events = await this.prisma.event.findMany({
      where: { status: 'PUBLISHED', isFeatured: true, endAt: { gte: new Date() } },
      orderBy: { startAt: 'asc' },
      take: limit,
      select: cardSelect,
    });
    return events.map((event) => {
      const capacityRemaining = eventCapacityRemaining(event.capacity, event.ticketsReserved, event.ticketsSold);
      const currentTime = new Date();
      const tickets = event.ticketTypes.filter((ticket) => ticket.salesEndAt === null || ticket.salesEndAt >= currentTime);
      const startingTicket = tickets.reduce<(typeof tickets)[number] | null>(
        (lowest, ticket) => !lowest || ticket.price.lessThan(lowest.price) ? ticket : lowest,
        null,
      );
      const { ticketTypes: _ticketTypes, capacity: _capacity, ticketsReserved: _reserved, ticketsSold: _sold, ...eventCard } = event;
      const available = tickets.some((ticket) => (ticket.salesStartAt === null || ticket.salesStartAt <= currentTime)
        && Math.max(0, Math.min(
        ticket.quantity - ticket.quantityReserved - ticket.quantitySold,
        capacityRemaining ?? Number.MAX_SAFE_INTEGER,
      )) > 0);
      return {
        ...eventCard,
        startingPrice: startingTicket?.price.toFixed(2) ?? null,
        currency: startingTicket?.currency ?? null,
        hasAvailability: available,
      };
    });
  }

  async get(identifier: string) {
    const event = await this.prisma.event.findFirst({
      where: { OR: [{ id: identifier }, { slug: identifier }], status: 'PUBLISHED' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        venue: true,
        city: true,
        startAt: true,
        endAt: true,
        timezone: true,
        coverImageUrl: true,
        category: { select: { id: true, name: true, slug: true } },
        organizer: { select: { organizerApplications: { where: { status: 'APPROVED' }, orderBy: { submittedAt: 'desc' }, take: 1, select: { organizationName: true } } } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    const { organizer, ...publicEvent } = event;
    return { ...publicEvent, organizerName: organizer.organizerApplications[0]?.organizationName ?? null };
  }

  async sessions(identifier: string) {
    const event = await this.findPublished(identifier);
    return this.prisma.eventSession.findMany({
      where: { eventId: event.id },
      orderBy: { startAt: 'asc' },
      select: { id: true, title: true, description: true, speaker: true, venue: true, startAt: true, endAt: true },
    });
  }

  async ticketTypes(identifier: string) {
    const event = await this.prisma.event.findFirst({
      where: { OR: [{ id: identifier }, { slug: identifier }], status: 'PUBLISHED' },
      select: { id: true, capacity: true, ticketsReserved: true, ticketsSold: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    const now = new Date();
    const ticketTypes = await this.prisma.ticketType.findMany({
      where: {
        eventId: event.id,
        isActive: true,
        OR: [{ salesEndAt: null }, { salesEndAt: { gte: now } }],
      },
      orderBy: [{ price: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        quantity: true,
        quantityReserved: true,
        quantitySold: true,
        salesStartAt: true,
        salesEndAt: true,
      },
    });
    const remainingCapacity = eventCapacityRemaining(event.capacity, event.ticketsReserved, event.ticketsSold);
    return ticketTypes.map((ticket) => {
      const availableQuantity = Math.max(0, Math.min(
        ticket.quantity - ticket.quantityReserved - ticket.quantitySold,
        remainingCapacity ?? Number.MAX_SAFE_INTEGER,
      ));
      return {
        id: ticket.id,
        name: ticket.name,
        description: ticket.description,
        price: ticket.price.toFixed(2),
        currency: ticket.currency,
        salesStartAt: ticket.salesStartAt,
        salesEndAt: ticket.salesEndAt,
        availableQuantity,
        isOnSale: availableQuantity > 0 && (!ticket.salesStartAt || ticket.salesStartAt <= now),
      };
    });
  }

  private async findPublished(identifier: string) {
    const event = await this.prisma.event.findFirst({
      where: { OR: [{ id: identifier }, { slug: identifier }], status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
}

export interface EventFilters {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  from?: Date;
  to?: Date;
  sort: 'startAt' | 'newest' | 'title';
  direction: 'asc' | 'desc';
}

function eventCapacityRemaining(capacity: number | null, reserved: number, sold: number): number | null {
  return capacity === null ? null : Math.max(0, capacity - reserved - sold);
}
