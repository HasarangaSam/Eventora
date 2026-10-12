import { ForbiddenException } from '@nestjs/common';
import { AuthService, type CurrentUser } from './auth.service.js';
import type { ClerkService } from './clerk.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('AuthService', () => {
  const clerkProfile = {
    id: 'user_clerk_test',
    primaryEmailAddressId: 'email_primary',
    emailAddresses: [{ id: 'email_primary', emailAddress: 'attendee@example.com' }],
    firstName: 'Event',
    lastName: 'Attendee',
    imageUrl: 'https://images.example.com/avatar.png',
  };

  const activeUser: CurrentUser = {
    email: 'attendee@example.com',
    firstName: 'Event',
    lastName: 'Attendee',
    imageUrl: 'https://images.example.com/avatar.png',
    role: 'ATTENDEE',
    status: 'ACTIVE',
  };

  let service: AuthService;
  let upsert: ReturnType<typeof vi.fn>;
  let getUser: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    upsert = vi.fn().mockResolvedValue(activeUser);
    getUser = vi.fn().mockResolvedValue(clerkProfile);
    const prisma = { user: { upsert } } as unknown as PrismaService;
    const clerk = { getUser } as unknown as ClerkService;
    service = new AuthService(prisma, clerk);
  });

  it('synchronizes by Clerk user ID without overwriting app role or status', async () => {
    await expect(service.getCurrentUser('user_clerk_test')).resolves.toEqual(activeUser);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { clerkUserId: 'user_clerk_test' },
      create: expect.objectContaining({
        clerkUserId: 'user_clerk_test',
        email: 'attendee@example.com',
      }),
      update: {
        email: 'attendee@example.com',
        firstName: 'Event',
        lastName: 'Attendee',
        imageUrl: 'https://images.example.com/avatar.png',
      },
    }));
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty('role');
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty('status');
  });

  it('repeats synchronization through the unique Clerk ID upsert', async () => {
    await service.getCurrentUser('user_clerk_test');
    await service.getCurrentUser('user_clerk_test');

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls.map(([args]) => args.where.clerkUserId)).toEqual([
      'user_clerk_test',
      'user_clerk_test',
    ]);
  });

  it('rejects a deactivated Eventora account after synchronizing the Clerk profile', async () => {
    upsert.mockResolvedValue({ ...activeUser, status: 'DEACTIVATED' });

    await expect(service.getCurrentUser('user_clerk_test')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(upsert).toHaveBeenCalledOnce();
  });
});
