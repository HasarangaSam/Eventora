import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AdminEventsController } from './admin-events.controller.js';
import type { OrganizerEventsService } from './organizer-events.service.js';

describe('AdminEventsController', () => {
  const events = { listForAdmin: vi.fn(), cancelAsAdmin: vi.fn() };
  const controller = new AdminEventsController(events as unknown as OrganizerEventsService);

  it('rejects unsupported event status filters', () => {
    expect(() => controller.list('ARCHIVED')).toThrow(BadRequestException);
    expect(events.listForAdmin).not.toHaveBeenCalled();
  });

  it('accepts only a reason for cancellation and attributes the action to the database admin', async () => {
    const request = { eventoraUser: { id: 'admin-1' } } as unknown as AuthenticatedRequest;
    await controller.cancel(request, 'event-1', { reason: 'Safety issue' });
    expect(events.cancelAsAdmin).toHaveBeenCalledWith('admin-1', 'event-1', 'Safety issue');
    expect(() => controller.cancel(request, 'event-1', { reason: 'ok' })).toThrow(BadRequestException);
    expect(() => controller.cancel(request, 'event-1', { reason: 'Safety issue', organizerId: 'forged' })).toThrow(BadRequestException);
  });

  it('requires the authenticated database account on cancellation requests', () => {
    expect(() => controller.cancel({} as AuthenticatedRequest, 'event-1', { reason: 'Safety issue' })).toThrow(BadRequestException);
  });
});
