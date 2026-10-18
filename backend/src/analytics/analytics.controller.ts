import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import { AnalyticsService } from './analytics.service.js';
import { ParticipantsQueryDto } from './dto/participants-query.dto.js';

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
    @Query() query: ParticipantsQueryDto,
  ) {
    return this.analytics.organizerParticipants(req.eventoraUser!.id, eventId, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
      search: query.search?.trim() ?? '',
      registrationStatus: query.registrationStatus,
      paymentStatus: query.paymentStatus,
      checkInStatus: query.checkInStatus,
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
