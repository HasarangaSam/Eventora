import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { describe, expect, it, vi } from 'vitest';
import type { InventoryService } from './inventory.service.js';
import { RegistrationsService } from './registrations.service.js';

const expiresAt = new Date('2030-01-01T00:10:00.000Z');
const registration = {
  id: 'registration-1', ticketTypeId: 'ticket-1', quantity: 2, unitPrice: new Prisma.Decimal('125.40'), totalAmount: new Prisma.Decimal('250.80'),
  currency: 'LKR', status: 'PENDING', createdAt: new Date('2030-01-01T00:00:00Z'),
  event: { id: 'event-1', title: 'Show', venue: 'Hall', city: 'Colombo', startAt: new Date('2030-02-01T10:00:00Z'), endAt: new Date('2030-02-01T12:00:00Z'), status: 'PUBLISHED' },
  ticketType: { id: 'ticket-1', name: 'Standard' }, reservation: { status: 'HELD', expiresAt },
  payments: [{ id: 'payment-1', status: 'INITIATED', amount: new Prisma.Decimal('250.80'), currency: 'LKR' }],
};

function setup() {
  const tx = {
    registration: {
      create: vi.fn().mockResolvedValue({ id: registration.id }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(registration),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ now: registration.createdAt }]),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const prisma = {
    ticketType: { findUnique: vi.fn().mockResolvedValue({ id: 'ticket-1', eventId: 'event-1' }) },
    registration: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const inventory = {
    expireDueReservations: vi.fn().mockResolvedValue(0),
    reserve: vi.fn().mockResolvedValue({ price: new Prisma.Decimal('125.40'), currency: 'LKR' }),
  };
  const service = new RegistrationsService(prisma as unknown as PrismaService, inventory as unknown as InventoryService);
  return { service, prisma, tx, inventory };
}

describe('RegistrationsService', () => {
  it('uses the database ticket price and creates a pending reservation/payment attempt atomically', async () => {
    const { service, prisma, tx, inventory } = setup();
    const result = await service.create('user-1', 'ticket-1', 2, 'request-key-123');

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(inventory.reserve).toHaveBeenCalledWith(tx, 'event-1', 'ticket-1', 2);
    const createData = tx.registration.create.mock.calls[0][0].data;
    expect(createData.unitPrice.toFixed(2)).toBe('125.40');
    expect(createData.totalAmount.toFixed(2)).toBe('250.80');
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    expect(createData.payments.create.status).toBe('INITIATED');
    expect(result).toMatchObject({ status: 'PENDING', totalAmount: '250.80', reservation: { status: 'HELD', expiresAt } });
  });

  it('replays an identical idempotency key without creating a second reservation', async () => {
    const { service, prisma, inventory } = setup();
    prisma.registration.findUnique.mockResolvedValue(registration);

    const result = await service.create('user-1', 'ticket-1', 2, 'request-key-123');

    expect(result.id).toBe('registration-1');
    expect(inventory.reserve).not.toHaveBeenCalled();
  });

  it('rejects reusing an idempotency key for different ticket data', async () => {
    const { service, prisma } = setup();
    prisma.registration.findUnique.mockResolvedValue(registration);
    await expect(service.create('user-1', 'ticket-1', 1, 'request-key-123')).rejects.toBeInstanceOf(ConflictException);
  });
});
