import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import type { AuthenticatedRequest } from './auth.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('RolesGuard', () => {
  const request = { eventoraUser: { id: 'user_1', role: 'ATTENDEE' } } as AuthenticatedRequest;
  const context = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  it('rejects attendees from admin routes', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector, {} as PrismaService);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an admin through an admin route using the database role', async () => {
    request.eventoraUser = { id: 'admin_1', role: 'ADMIN' } as AuthenticatedRequest['eventoraUser'];
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['ADMIN']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector, {} as PrismaService);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('requires an approved application for organizer access', async () => {
    request.eventoraUser = { id: 'organizer_1', role: 'ORGANIZER' } as AuthenticatedRequest['eventoraUser'];
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['ORGANIZER']) } as unknown as Reflector;
    const findFirst = vi.fn().mockResolvedValue(null);
    const guard = new RolesGuard(reflector, {
      organizerApplication: { findFirst },
    } as unknown as PrismaService);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findFirst).toHaveBeenCalledWith({
      where: { applicantId: 'organizer_1', status: 'APPROVED' },
      select: { id: true },
    });
  });

  it('allows an approved organizer through organizer routes', async () => {
    request.eventoraUser = { id: 'organizer_1', role: 'ORGANIZER' } as AuthenticatedRequest['eventoraUser'];
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['ORGANIZER']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector, {
      organizerApplication: { findFirst: vi.fn().mockResolvedValue({ id: 'application_1' }) },
    } as unknown as PrismaService);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
