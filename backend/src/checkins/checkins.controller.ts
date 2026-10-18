import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import { CheckinsService } from './checkins.service.js';
import { CheckinDto, CheckinForEventDto } from './dto/checkin.dto.js';
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
  attendance(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Query('page') rawPage?: string, @Query('pageSize') rawPageSize?: string) {
    return this.getAttendance(request, eventId, rawPage, rawPageSize);
  }

  @Get('organizer/events/:eventId/attendance')
  eventAttendance(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Query('page') rawPage?: string, @Query('pageSize') rawPageSize?: string) {
    return this.getAttendance(request, eventId, rawPage, rawPageSize);
  }

  private getAttendance(request: AuthenticatedRequest, eventId: string, rawPage?: string, rawPageSize?: string) {
    const page = parsePositiveInt(rawPage, 1, 'page');
    const pageSize = parsePositiveInt(rawPageSize, 25, 'pageSize');
    if (pageSize > 100) throw new BadRequestException('pageSize cannot exceed 100');
    return this.checkins.attendance(userId(request), eventId, page, pageSize);
  }
}

function userId(request: AuthenticatedRequest) {
  if (!request.eventoraUser) throw new BadRequestException('Authenticated account is required');
  return request.eventoraUser.id;
}

function parsePositiveInt(value: string | undefined, fallback: number, name: string) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new BadRequestException(`${name} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new BadRequestException(`${name} must be a positive integer`);
  return parsed;
}
