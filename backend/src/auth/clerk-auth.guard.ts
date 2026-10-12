import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ClerkService } from './clerk.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly clerk: ClerkService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.clerkUserId = await this.clerk.authenticate(request);
    return true;
  }
}
