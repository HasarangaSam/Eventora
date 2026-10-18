import { BadRequestException, Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OrganizerEventsService } from './organizer-events.service.js';
import { CancelEventDto } from './dto/cancel-event.dto.js';
import { ensureDto } from '../common/validation/dto-validator.js';

const eventStatuses = ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'] as const;

@Controller('admin/events')
@UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
@RequireRoles('ADMIN')
export class AdminEventsController {
  constructor(private readonly events: OrganizerEventsService) {}

  @Get()
  list(@Query('status') status?: string) {
    if (status && !eventStatuses.includes(status as typeof eventStatuses[number])) {
      throw new BadRequestException(`status must be one of ${eventStatuses.join(', ')}`);
    }
    return this.events.listForAdmin(status as typeof eventStatuses[number] | undefined);
  }

  @Patch(':eventId/cancel')
  cancel(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: CancelEventDto) {
    const dto = ensureDto(CancelEventDto, body);
    if (!request.eventoraUser) throw new BadRequestException('Authenticated account is required');
    return this.events.cancelAsAdmin(request.eventoraUser.id, eventId, dto.reason.trim());
  }
}
