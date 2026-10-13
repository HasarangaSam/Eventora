import { BadRequestException, Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OrganizerNotificationsService } from './organizer-notifications.service.js';

@Controller('organizer/notifications')
@UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
@RequireRoles('ORGANIZER')
export class OrganizerNotificationsController {
  constructor(private readonly notifications: OrganizerNotificationsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.notifications.list(request.eventoraUser!.id);
  }

  @Patch('read')
  markRead(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new BadRequestException('A JSON object is required');
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((key) => key !== 'notificationIds')) throw new BadRequestException('Unsupported notification update field');
    if (!Array.isArray(input.notificationIds) || input.notificationIds.length > 100 || input.notificationIds.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 255) || new Set(input.notificationIds).size !== input.notificationIds.length) {
      throw new BadRequestException('notificationIds must contain up to 100 distinct notification IDs');
    }
    return this.notifications.markRead(request.eventoraUser!.id, input.notificationIds as string[]);
  }
}
