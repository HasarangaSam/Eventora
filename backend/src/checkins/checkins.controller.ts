import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import { CheckinsService, type CheckInMethod } from './checkins.service.js';

@Controller()
@UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
@RequireRoles('ORGANIZER')
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Post('check-ins/validate')
  validate(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = objectBody(body);
    const { eventId, value, method } = checkinBody(input, ['eventId', 'value', 'method']);
    return this.checkins.checkIn(userId(request), eventId, value, method, false);
  }

  @Post('check-ins')
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = objectBody(body);
    const { eventId, value, method } = checkinBody(input, ['eventId', 'value', 'method']);
    return this.checkins.checkIn(userId(request), eventId, value, method);
  }

  @Post('organizer/events/:eventId/check-ins')
  createForEvent(@Req() request: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: unknown) {
    const input = objectBody(body);
    const { value, method } = checkinBody(input, ['value', 'method']);
    return this.checkins.checkIn(userId(request), eventId, value, method);
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

function checkinBody(input: Record<string, unknown>, allowed: readonly string[]) {
  onlyKeys(input, allowed);
  if (allowed.includes('eventId') && (typeof input.eventId !== 'string' || !input.eventId.trim() || input.eventId.length > 64)) throw new BadRequestException('eventId is required');
  if (typeof input.value !== 'string' || input.value.trim().length < 1 || input.value.trim().length > 256) throw new BadRequestException('value must be between 1 and 256 characters');
  if (input.method !== 'QR_SCAN' && input.method !== 'MANUAL_REFERENCE') throw new BadRequestException('method must be QR_SCAN or MANUAL_REFERENCE');
  return { eventId: typeof input.eventId === 'string' ? input.eventId.trim() : '', value: input.value.trim(), method: input.method as CheckInMethod };
}

function userId(request: AuthenticatedRequest) {
  if (!request.eventoraUser) throw new BadRequestException('Authenticated account is required');
  return request.eventoraUser.id;
}
function objectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new BadRequestException('A JSON object is required');
  return value as Record<string, unknown>;
}
function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]) {
  const unknown = Object.keys(body).find((key) => !allowed.includes(key));
  if (unknown) throw new BadRequestException(`Unsupported field: ${unknown}`);
}
function parsePositiveInt(value: string | undefined, fallback: number, name: string) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new BadRequestException(`${name} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new BadRequestException(`${name} must be a positive integer`);
  return parsed;
}
