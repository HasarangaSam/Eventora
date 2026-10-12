import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class AccountGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId: request.clerkUserId },
    });
    if (!user) throw new UnauthorizedException('Synchronize your account before continuing');
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('This Eventora account is deactivated');
    }
    request.eventoraUser = user;
    return true;
  }
}
