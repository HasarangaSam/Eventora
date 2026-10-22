import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OrganizerNotificationsService } from './organizer-notifications.service.js';
import { MarkOrganizerNotificationsReadDto } from './dto/mark-notifications-read.dto.js';
import { ensureDto } from '../common/validation/dto-validator.js';

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
  markRead(@Req() request: AuthenticatedRequest, @Body() body: MarkOrganizerNotificationsReadDto) {
    const dto = ensureDto(MarkOrganizerNotificationsReadDto, body);
    return this.notifications.markRead(request.eventoraUser!.id, dto.notificationIds);
  }
}
