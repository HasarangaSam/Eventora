import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AccountGuard } from './account.guard.js';
import type { AuthenticatedRequest } from './auth.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('AccountGuard', () => {
  const request = { clerkUserId: 'clerk_123' } as AuthenticatedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;

  it('loads the database account for the verified Clerk identity', async () => {
    const user = { id: 'db_1', clerkUserId: 'clerk_123', status: 'ACTIVE', role: 'ATTENDEE' };
    const findUnique = vi.fn().mockResolvedValue(user);
    const guard = new AccountGuard({ user: { findUnique } } as unknown as PrismaService);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { clerkUserId: 'clerk_123' } });
    expect(request.eventoraUser).toEqual(user);
  });

  it('rejects a missing Eventora identity', async () => {
    const guard = new AccountGuard({ user: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as PrismaService);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a deactivated account', async () => {
    const guard = new AccountGuard({
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'db_1', status: 'DEACTIVATED' }) },
    } as unknown as PrismaService);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
