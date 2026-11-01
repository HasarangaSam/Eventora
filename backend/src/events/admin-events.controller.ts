import { BadRequestException, Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OrganizerEventsService } from './organizer-events.service.js';
import { CancelEventDto } from './dto/cancel-event.dto.js';
import { ensureDto } from '../common/validation/dto-validator.js';

const eventStatuses = ['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'] as const;
type EventStatus = typeof eventStatuses[number];

class AdminEventFilterDto {
  @IsOptional()
  @IsIn(eventStatuses, { message: `status must be one of ${eventStatuses.join(', ')}` })
  status?: EventStatus;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

@Controller('admin/events')
@UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
@RequireRoles('ADMIN')
export class AdminEventsController {
  constructor(private readonly events: OrganizerEventsService) {}

  @Get()
  list(@Query() query: AdminEventFilterDto) {
    return this.events.listForAdmin(query);
  }

  @Get(':eventId')
  detail(@Param('eventId') eventId: string) { return this.events.getForAdmin(eventId); }

  @Patch(':eventId/cancel')
  cancel(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: CancelEventDto) {
    const dto = ensureDto(CancelEventDto, body);
    if (!request.eventoraUser) throw new BadRequestException('Authenticated account is required');
    return this.events.cancelAsAdmin(request.eventoraUser.id, eventId, dto.reason.trim());
  }
}
