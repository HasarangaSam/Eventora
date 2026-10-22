import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { OrganizerApplicationStatus } from '../generated/prisma/client.js';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OrganizerApplicationsService } from './organizer-applications.service.js';
import { ClerkService } from '../auth/clerk.service.js';
import {
  DecideApplicationDto,
  ListApplicationsQueryDto,
  MarkNotificationsReadDto,
  SetUserRoleDto,
  SetUserStatusDto,
  SubmitOrganizerApplicationDto,
} from './dto/organizer-application.dto.js';
import { ensureDto } from '../common/validation/dto-validator.js';

@Controller()
@UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
export class OrganizerApplicationsController {
  constructor(private readonly applications: OrganizerApplicationsService, private readonly clerk: ClerkService) {}

  @Post('organizer-applications')
  @RequireRoles('ATTENDEE')
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  async submit(@Req() request: AuthenticatedRequest, @Body() body: SubmitOrganizerApplicationDto) {
    const dto = ensureDto(SubmitOrganizerApplicationDto, body);
    // categoryIds element-type, length, and uniqueness are enforced by the DTO.
    // phone format is enforced by the DTO @Matches decorator.
    // websiteUrl format is enforced by the DTO @IsUrl decorator.
    const profile = await this.clerk.getUser(request.clerkUserId);
    const primaryEmail = profile.primaryEmailAddress;
    if (!primaryEmail || primaryEmail.verification?.status !== 'verified') {
      throw new UnprocessableEntityException('Verify your primary Clerk email before applying');
    }
    return this.applications.submit(request.eventoraUser!, {
      organizationName: dto.organizationName.trim(),
      description: dto.description.trim(),
      contactName: dto.contactName.trim(),
      contactPhone: dto.contactPhone.trim(),
      organizerType: dto.organizerType,
      country: dto.country.trim(),
      city: dto.city.trim(),
      websiteUrl: dto.websiteUrl ?? null,
      experience: dto.experience.trim(),
      eventFrequency: dto.eventFrequency,
      expectedAttendance: dto.expectedAttendance,
      categoryIds: dto.categoryIds,
    }, primaryEmail.emailAddress);
  }

  @Get('organizer-applications/me')
  getMine(@Req() request: AuthenticatedRequest) {
    return this.applications.getMine(request.eventoraUser!.id);
  }

  @Get('organizer-applications')
  @RequireRoles('ADMIN')
  list(@Query() query: ListApplicationsQueryDto) {
    return this.applications.list(query.status as OrganizerApplicationStatus | undefined);
  }

  @Get('admin/notifications')
  @RequireRoles('ADMIN')
  adminNotifications(@Req() request: AuthenticatedRequest) {
    return this.applications.adminNotifications(request.eventoraUser!.id);
  }

  @Patch('admin/notifications/read')
  @RequireRoles('ADMIN')
  markNotificationsRead(@Req() request: AuthenticatedRequest, @Body() body: MarkNotificationsReadDto) {
    const dto = ensureDto(MarkNotificationsReadDto, body);
    return this.applications.markAdminNotificationsRead(request.eventoraUser!.id, dto.notificationIds);
  }

  @Get('organizer-applications/:applicationId')
  @RequireRoles('ADMIN')
  getById(@Param('applicationId') id: string) {
    return this.applications.getById(id);
  }

  @Patch('organizer-applications/:applicationId/decision')
  @RequireRoles('ADMIN')
  decide(
    @Param('applicationId') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: DecideApplicationDto,
  ) {
    const dto = ensureDto(DecideApplicationDto, body);
    const decisionNote = dto.decisionNote === undefined || dto.decisionNote === null || dto.decisionNote.trim() === ''
      ? null
      : dto.decisionNote.trim();
    return this.applications.decide(id, request.eventoraUser!, dto.status, decisionNote);
  }

  @Get('users')
  @RequireRoles('ADMIN')
  listUsers() {
    return this.applications.listUsers();
  }

  @Patch('users/:userId/role')
  @RequireRoles('ADMIN')
  setRole(
    @Param('userId') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: SetUserRoleDto,
  ) {
    const dto = ensureDto(SetUserRoleDto, body);
    return this.applications.setUserRole(id, dto.role, request.eventoraUser!.id);
  }

  @Patch('users/:userId/status')
  @RequireRoles('ADMIN')
  setStatus(
    @Param('userId') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: SetUserStatusDto,
  ) {
    const dto = ensureDto(SetUserStatusDto, body);
    return this.applications.setUserStatus(id, dto.status, request.eventoraUser!.id);
  }
}
