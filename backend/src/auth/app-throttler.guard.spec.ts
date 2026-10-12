import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import { AppThrottlerGuard } from './app-throttler.guard.js';

describe('AppThrottlerGuard', () => {
  const reflector = new Reflector();
  const storageMock = {
    increment: () => Promise.resolve({ totalHits: 1, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }),
  };

  const guard = new AppThrottlerGuard(
    { throttlers: [{ name: 'default', ttl: 60000, limit: 100 }] },
    storageMock as any,
    reflector,
  );

  it('isolates tracker by bearer token when Authorization header is provided', async () => {
    const getTracker = (guard as any).getTracker.bind(guard);
    const tracker = await getTracker({
      headers: {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.session-token-sample-123456789012345',
      },
      ip: '127.0.0.1',
    });

    expect(tracker).toMatch(/^auth_/);
    expect(tracker).toBe('auth_ion-token-sample-123456789012345');
  });

  it('falls back to IP tracker when Authorization header is absent', async () => {
    const getTracker = (guard as any).getTracker.bind(guard);
    const tracker = await getTracker({
      headers: {},
      ip: '192.168.1.50',
    });

    expect(tracker).toBe('192.168.1.50');
  });
});
