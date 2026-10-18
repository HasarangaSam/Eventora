import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizerEventsService } from './organizer-events.service.js';
import type { CloudinaryService } from './cloudinary.service.js';
import type { InventoryService } from '../registrations/inventory.service.js';

const baseEvent = {
  id: 'event-1', organizerId: 'organizer-1', categoryId: 'category-1', title: 'Concert', slug: 'concert', description: 'Description',
  venue: 'Hall', city: 'Colombo', startAt: new Date('2030-01-02T10:00:00Z'), endAt: new Date('2030-01-02T12:00:00Z'),
  timezone: 'Asia/Colombo', capacity: 100, ticketsReserved: 0, ticketsSold: 0, coverImageUrl: null, coverImagePublicId: null,
  status: 'DRAFT', isFeatured: false, publishedAt: null, cancelledAt: null, cancelledById: null, cancellationReason: null,
  createdAt: new Date(), updatedAt: new Date(),
};

function setup() {
  const prisma = {
    event: { findFirst: vi.fn().mockResolvedValue(baseEvent), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    category: { findFirst: vi.fn() }, ticketType: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    eventSession: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    registration: { findMany: vi.fn() }, $transaction: vi.fn(),
  };
  const cloudinary = { upload: vi.fn(), destroy: vi.fn() };
  const inventory = { releaseEventReservations: vi.fn().mockResolvedValue(0) };
  return {
    prisma,
    cloudinary,
    inventory,
    service: new OrganizerEventsService(prisma as unknown as PrismaService, cloudinary as unknown as CloudinaryService, inventory as unknown as InventoryService),
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

  it('allows replacing cover image on a published event', async () => {
    const { service, prisma, cloudinary } = setup();
    prisma.event.findFirst.mockResolvedValue({ id: 'event-1', organizerId: 'organizer-1', status: 'PUBLISHED', coverImagePublicId: null });
    cloudinary.upload.mockResolvedValue({ url: 'https://cdn.test/img.png', publicId: 'img-1' });
    prisma.event.update.mockResolvedValue({});
    const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    const res = await service.replaceCover('organizer-1', 'event-1', { buffer: pngBuffer, mimetype: 'image/png' });
    expect(res).toEqual({ coverImageUrl: 'https://cdn.test/img.png' });
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

  it('limits admin event oversight to the latest 100 records and applies its status filter', async () => {
    const { service, prisma } = setup();
    prisma.event.findMany.mockResolvedValue([]);
    await service.listForAdmin('PUBLISHED');
    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'PUBLISHED' }, orderBy: { updatedAt: 'desc' }, take: 100,
      select: expect.objectContaining({ organizer: expect.any(Object), _count: expect.any(Object) }),
    }));
  });

  it('lets an admin cancel any event atomically and queues notices while preserving records', async () => {
    const { service, prisma, cloudinary, inventory } = setup();
    prisma.event.findUnique.mockResolvedValue({ id: 'event-1', status: 'PUBLISHED' });
    const tx = {
      event: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      registration: { findMany: vi.fn().mockResolvedValue([{ id: 'registration-1', attendee: { email: 'attendee@example.test' } }]) },
      emailDelivery: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    const result = await service.cancelAsAdmin('admin-1', 'event-1', 'Safety issue');
    expect(result).toEqual({ id: 'event-1', status: 'CANCELLED', cancellationNoticesQueued: 1 });
    expect(tx.event.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'event-1', status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      data: expect.objectContaining({ cancelledById: 'admin-1', cancellationReason: 'Safety issue', status: 'CANCELLED' }),
    }));
    expect(tx.registration.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: 'event-1', status: 'CONFIRMED' } }));
    expect(tx.emailDelivery.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(inventory.releaseEventReservations).toHaveBeenCalledWith(tx, 'event-1');
    expect(cloudinary.destroy).not.toHaveBeenCalled();
  });

  it('does not cancel events that are already completed or missing', async () => {
    const { service, prisma } = setup();
    prisma.event.findUnique.mockResolvedValue({ id: 'event-1', status: 'COMPLETED' });
    await expect(service.cancelAsAdmin('admin-1', 'event-1', 'Reason')).rejects.toBeInstanceOf(ConflictException);
    prisma.event.findUnique.mockResolvedValue(null);
    await expect(service.cancelAsAdmin('admin-1', 'missing', 'Reason')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
