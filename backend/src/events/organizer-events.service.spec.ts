import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizerEventsService } from './organizer-events.service.js';
import type { CloudinaryService } from './cloudinary.service.js';

const baseEvent = {
  id: 'event-1', organizerId: 'organizer-1', categoryId: 'category-1', title: 'Concert', slug: 'concert', description: 'Description',
  venue: 'Hall', city: 'Colombo', startAt: new Date('2030-01-02T10:00:00Z'), endAt: new Date('2030-01-02T12:00:00Z'),
  timezone: 'Asia/Colombo', capacity: 100, ticketsReserved: 0, ticketsSold: 0, coverImageUrl: null, coverImagePublicId: null,
  status: 'DRAFT', isFeatured: false, publishedAt: null, cancelledAt: null, cancelledById: null, cancellationReason: null,
  createdAt: new Date(), updatedAt: new Date(),
};

function setup() {
  const prisma = {
    event: { findFirst: vi.fn().mockResolvedValue(baseEvent), findUniqueOrThrow: vi.fn(), update: vi.fn(), create: vi.fn() },
    category: { findFirst: vi.fn() }, ticketType: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    eventSession: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    registration: { findMany: vi.fn() }, $transaction: vi.fn(),
  };
  const cloudinary = { upload: vi.fn(), destroy: vi.fn() };
  return {
    prisma,
    cloudinary,
    service: new OrganizerEventsService(prisma as unknown as PrismaService, cloudinary as unknown as CloudinaryService),
  };
}

describe('OrganizerEventsService', () => {
  it('does not reveal an event when the organizer does not own it', async () => {
    const { service, prisma } = setup();
    prisma.event.findFirst.mockResolvedValue(null);
    await expect(service.get('another-organizer', 'event-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a free ticket type before writing it', async () => {
    const { service, prisma } = setup();
    await expect(service.addTicketType('organizer-1', 'event-1', {
      name: 'Free', price: '0.00', currency: 'LKR', quantity: 10,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ticketType.create).not.toHaveBeenCalled();
  });

  it('cannot reduce ticket quantity below existing commitments', async () => {
    const { service, prisma } = setup();
    prisma.ticketType.findFirst.mockResolvedValue({
      id: 'ticket-1', eventId: 'event-1', name: 'Standard', description: null, price: { toString: () => '1000.00' },
      currency: 'LKR', quantity: 20, quantityReserved: 2, quantitySold: 5, salesStartAt: null, salesEndAt: null, isActive: true,
    });
    await expect(service.updateTicketType('organizer-1', 'event-1', 'ticket-1', { quantity: 6 })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.ticketType.update).not.toHaveBeenCalled();
  });

  it('rejects cover uploads whose bytes do not match an allowed image', async () => {
    const { service, cloudinary } = setup();
    await expect(service.replaceCover('organizer-1', 'event-1', { buffer: Buffer.from('not an image'), mimetype: 'image/png' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(cloudinary.upload).not.toHaveBeenCalled();
  });

  it('requires an active, paid ticket with inventory before publication', async () => {
    const { service, prisma } = setup();
    prisma.event.findUniqueOrThrow.mockResolvedValue({ ...baseEvent, category: { isActive: true }, ticketTypes: [] });
    await expect(service.publish('organizer-1', 'event-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it('rejects a schedule entry outside the event time range', async () => {
    const { service, prisma } = setup();
    await expect(service.addSession('organizer-1', 'event-1', {
      title: 'After party', startAt: new Date('2030-01-02T12:30:00Z'), endAt: new Date('2030-01-02T13:00:00Z'),
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.eventSession.create).not.toHaveBeenCalled();
  });
});
