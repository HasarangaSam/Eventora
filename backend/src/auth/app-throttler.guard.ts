import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    // If request contains an Authorization Bearer token, isolate rate limit by token signature
    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return `auth_${authHeader.slice(-32)}`;
    }

    // Fall back to client IP tracker (with IPv6 normalization)
    return super.getTracker(req);
  }
}
