import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UserRole } from '../generated/prisma/client.js';
import type { AuthenticatedRequest } from './auth.types.js';

const ROLES_KEY = 'eventora:roles';

export const RequireRoles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.eventoraUser || !roles.includes(request.eventoraUser.role)) {
      throw new ForbiddenException('Your Eventora role cannot access this resource');
    }
    if (request.eventoraUser.role === 'ORGANIZER' && roles.includes('ORGANIZER')) {
      const approvedApplication = await this.prisma.organizerApplication.findFirst({
        where: { applicantId: request.eventoraUser.id, status: 'APPROVED' },
        select: { id: true },
      });
      if (!approvedApplication) {
        throw new ForbiddenException('An approved organizer application is required');
      }
    }
    return true;
  }
}
