import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import { AnalyticsService } from './analytics.service.js';

@Controller()
@UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('attendee/dashboard')
  @RequireRoles('ATTENDEE')
  attendee(@Req() req: AuthenticatedRequest) { return this.analytics.attendee(req.eventoraUser!.id); }

  @Get('organizer/dashboard')
  @RequireRoles('ORGANIZER')
  organizer(@Req() req: AuthenticatedRequest) { return this.analytics.organizer(req.eventoraUser!.id); }

  @Get('organizer/analytics/overview')
  @RequireRoles('ORGANIZER')
  organizerOverview(@Req() req: AuthenticatedRequest) { return this.analytics.organizer(req.eventoraUser!.id); }

  @Get('organizer/analytics/sales')
  @RequireRoles('ORGANIZER')
  organizerSales(@Req() req: AuthenticatedRequest) { return this.analytics.organizerSales(req.eventoraUser!.id); }

  @Get('organizer/analytics/events')
  @RequireRoles('ORGANIZER')
  organizerEventSales(@Req() req: AuthenticatedRequest) { return this.analytics.organizerEventSales(req.eventoraUser!.id); }

  @Get('organizer/events/:eventId/participants')
  @RequireRoles('ORGANIZER')
  organizerParticipants(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('registrationStatus') registrationStatus?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('checkInStatus') checkInStatus?: string,
  ) {
    const positive = (raw: string | undefined, fallback: number, field: string) => {
      if (raw === undefined) return fallback;
      if (!/^\d+$/.test(raw) || Number(raw) < 1 || !Number.isSafeInteger(Number(raw))) throw new BadRequestException(`${field} must be a positive integer`);
      return Number(raw);
    };
    const parsedPage = positive(page, 1, 'page');
    const parsedSize = positive(pageSize, 25, 'pageSize');
    if (parsedSize > 100) throw new BadRequestException('pageSize cannot exceed 100');
    if (registrationStatus && !['PENDING', 'CONFIRMED', 'EXPIRED'].includes(registrationStatus)) throw new BadRequestException('registrationStatus is invalid');
    if (paymentStatus && !['INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CHARGEDBACK', 'UNPAID'].includes(paymentStatus)) throw new BadRequestException('paymentStatus is invalid');
    if (checkInStatus && !['CHECKED_IN', 'NOT_CHECKED_IN'].includes(checkInStatus)) throw new BadRequestException('checkInStatus is invalid');
    return this.analytics.organizerParticipants(req.eventoraUser!.id, eventId, {
      page: parsedPage, pageSize: parsedSize, search: search?.trim().slice(0, 120) ?? '',
      registrationStatus, paymentStatus, checkInStatus,
    });
  }

  @Get('organizer/analytics/registrations')
  @RequireRoles('ORGANIZER')
  organizerRegistrations(@Req() req: AuthenticatedRequest) { return this.analytics.organizerRegistrations(req.eventoraUser!.id); }

  @Get('organizer/analytics/attendance')
  @RequireRoles('ORGANIZER')
  organizerAttendance(@Req() req: AuthenticatedRequest) { return this.analytics.organizerAttendance(req.eventoraUser!.id); }

  @Get('organizer/events/:eventId/analytics')
  @RequireRoles('ORGANIZER')
  organizerEvent(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) { return this.analytics.organizerEvent(req.eventoraUser!.id, eventId); }

  @Get('admin/dashboard')
  @RequireRoles('ADMIN')
  admin() { return this.analytics.admin(); }

  @Get('admin/analytics/overview')
  @RequireRoles('ADMIN')
  adminOverview() { return this.analytics.admin(); }

  @Get('admin/analytics/sales')
  @RequireRoles('ADMIN')
  adminSales() { return this.analytics.adminSales(); }

  @Get('admin/analytics/registrations')
  @RequireRoles('ADMIN')
  adminRegistrations() { return this.analytics.adminRegistrations(); }

  @Get('admin/analytics/attendance')
  @RequireRoles('ADMIN')
  adminAttendance() { return this.analytics.adminAttendance(); }

  @Get('admin/analytics/payments')
  @RequireRoles('ADMIN')
  adminPayments() { return this.analytics.adminPayments(); }
}
