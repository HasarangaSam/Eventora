import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import { CheckinsService } from './checkins.service.js';
import { CheckinDto, CheckinForEventDto } from './dto/checkin.dto.js';
import { AttendanceQueryDto } from './dto/attendance-query.dto.js';
import { ensureDto } from '../common/validation/dto-validator.js';

@Controller()
@UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
@RequireRoles('ORGANIZER')
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Post('check-ins/validate')
  validate(@Req() request: AuthenticatedRequest, @Body() body: CheckinDto) {
    const dto = ensureDto(CheckinDto, body);
    return this.checkins.checkIn(userId(request), dto.eventId.trim(), dto.value.trim(), dto.method, false);
  }

  @Post('check-ins')
  create(@Req() request: AuthenticatedRequest, @Body() body: CheckinDto) {
    const dto = ensureDto(CheckinDto, body);
    return this.checkins.checkIn(userId(request), dto.eventId.trim(), dto.value.trim(), dto.method);
  }

  @Post('organizer/events/:eventId/check-ins')
  createForEvent(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: CheckinForEventDto) {
    const dto = ensureDto(CheckinForEventDto, body);
    return this.checkins.checkIn(userId(request), eventId, dto.value.trim(), dto.method);
  }

  @Get('organizer/events/:eventId/check-ins')
  attendance(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Query() query: AttendanceQueryDto) {
    return this.checkins.attendance(userId(request), eventId, query.page ?? 1, query.pageSize ?? 25);
  }

  @Get('organizer/events/:eventId/attendance')
  eventAttendance(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Query() query: AttendanceQueryDto) {
    return this.checkins.attendance(userId(request), eventId, query.page ?? 1, query.pageSize ?? 25);
  }
}

function userId(request: AuthenticatedRequest) {
  if (!request.eventoraUser) throw new BadRequestException('Authenticated account is required');
  return request.eventoraUser.id;
}
