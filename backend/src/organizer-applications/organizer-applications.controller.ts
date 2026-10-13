import {
  BadRequestException,
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
import type { OrganizerApplicationStatus, UserRole, UserStatus } from '../generated/prisma/client.js';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OrganizerApplicationsService } from './organizer-applications.service.js';
import { ClerkService } from '../auth/clerk.service.js';

@Controller()
@UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
export class OrganizerApplicationsController {
  constructor(private readonly applications: OrganizerApplicationsService, private readonly clerk: ClerkService) {}

  @Post('organizer-applications')
  @RequireRoles('ATTENDEE')
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  async submit(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = objectBody(body);
    onlyKeys(input, ['organizationName', 'description', 'contactName', 'contactPhone', 'organizerType', 'country', 'city', 'websiteUrl', 'experience', 'eventFrequency', 'expectedAttendance', 'categoryIds', 'accuracyConfirmed', 'rulesAccepted']);
    if (input.accuracyConfirmed !== true || input.rulesAccepted !== true) throw new BadRequestException('Both application confirmations are required');
    if (!Array.isArray(input.categoryIds) || input.categoryIds.length < 1 || input.categoryIds.length > 20 || input.categoryIds.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 64) || new Set(input.categoryIds).size !== input.categoryIds.length) {
      throw new BadRequestException('Select one or more distinct Eventora categories');
    }
    if (!['INDIVIDUAL', 'COMPANY', 'EDUCATIONAL_INSTITUTION', 'NONPROFIT', 'OTHER'].includes(String(input.organizerType))) throw new BadRequestException('Select a valid organizer type');
    if (!['ONE_TIME', 'OCCASIONALLY', 'MONTHLY', 'FREQUENTLY'].includes(String(input.eventFrequency))) throw new BadRequestException('Select an expected event frequency');
    const expectedAttendance = input.expectedAttendance;
    if (typeof expectedAttendance !== 'number' || !Number.isSafeInteger(expectedAttendance) || expectedAttendance < 1 || expectedAttendance > 1_000_000) throw new BadRequestException('expectedAttendance must be between 1 and 1000000');
    const websiteUrl = input.websiteUrl === undefined || input.websiteUrl === null || input.websiteUrl === ''
      ? null
      : validUrl(input.websiteUrl);
    const profile = await this.clerk.getUser(request.clerkUserId);
    const primaryEmail = profile.primaryEmailAddress;
    if (!primaryEmail || primaryEmail.verification?.status !== 'verified') {
      throw new UnprocessableEntityException('Verify your primary Clerk email before applying');
    }
    return this.applications.submit(request.eventoraUser!, {
      organizationName: textField(input, 'organizationName', 2, 200),
      description: textField(input, 'description', 20, 5000),
      contactName: textField(input, 'contactName', 2, 200),
      contactPhone: phoneField(input),
      organizerType: input.organizerType as 'INDIVIDUAL' | 'COMPANY' | 'EDUCATIONAL_INSTITUTION' | 'NONPROFIT' | 'OTHER',
      country: textField(input, 'country', 2, 100),
      city: textField(input, 'city', 1, 120),
      websiteUrl,
      experience: textField(input, 'experience', 10, 5000),
      eventFrequency: input.eventFrequency as 'ONE_TIME' | 'OCCASIONALLY' | 'MONTHLY' | 'FREQUENTLY',
      expectedAttendance,
      categoryIds: input.categoryIds as string[],
    }, primaryEmail.emailAddress);
  }

  @Get('organizer-applications/me')
  getMine(@Req() request: AuthenticatedRequest) {
    return this.applications.getMine(request.eventoraUser!.id);
  }

  @Get('organizer-applications')
  @RequireRoles('ADMIN')
  list(@Query('status') status?: string) {
    if (status && !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      throw new BadRequestException('status must be PENDING, APPROVED, or REJECTED');
    }
    return this.applications.list(status as OrganizerApplicationStatus | undefined);
  }

  @Get('admin/notifications')
  @RequireRoles('ADMIN')
  adminNotifications(@Req() request: AuthenticatedRequest) {
    return this.applications.adminNotifications(request.eventoraUser!.id);
  }

  @Patch('admin/notifications/read')
  @RequireRoles('ADMIN')
  markNotificationsRead(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = objectBody(body);
    onlyKeys(input, ['notificationIds']);
    if (!Array.isArray(input.notificationIds) || input.notificationIds.length > 100 || input.notificationIds.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 255) || new Set(input.notificationIds).size !== input.notificationIds.length) {
      throw new BadRequestException('notificationIds must contain up to 100 distinct notification IDs');
    }
    return this.applications.markAdminNotificationsRead(request.eventoraUser!.id, input.notificationIds as string[]);
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
    @Body() body: unknown,
  ) {
    const input = objectBody(body);
    if (input.status !== 'APPROVED' && input.status !== 'REJECTED') {
      throw new BadRequestException('status must be APPROVED or REJECTED');
    }
    const decisionNote = input.decisionNote === undefined || input.decisionNote === null
      ? null
      : textField(input, 'decisionNote', 1, 2000);
    return this.applications.decide(id, request.eventoraUser!, input.status, decisionNote);
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
    @Body() body: unknown,
  ) {
    const input = objectBody(body);
    if (!['ATTENDEE', 'ORGANIZER', 'ADMIN'].includes(String(input.role))) {
      throw new BadRequestException('role must be ATTENDEE, ORGANIZER, or ADMIN');
    }
    return this.applications.setUserRole(id, input.role as UserRole, request.eventoraUser!.id);
  }

  @Patch('users/:userId/status')
  @RequireRoles('ADMIN')
  setStatus(
    @Param('userId') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = objectBody(body);
    if (input.status !== 'ACTIVE' && input.status !== 'DEACTIVATED') {
      throw new BadRequestException('status must be ACTIVE or DEACTIVATED');
    }
    return this.applications.setUserStatus(id, input.status as UserStatus, request.eventoraUser!.id);
  }
}

function objectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('A JSON object is required');
  }
  return value as Record<string, unknown>;
}

function textField(
  body: Record<string, unknown>,
  name: string,
  minimum: number,
  maximum: number,
): string {
  const value = body[name];
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) {
    throw new BadRequestException(`${name} must be between ${minimum} and ${maximum} characters`);
  }
  return value.trim();
}

function phoneField(body: Record<string, unknown>) {
  const phone = textField(body, 'contactPhone', 7, 40);
  if (!/^\+?[0-9().\s-]{7,40}$/.test(phone) || !/\d{7,}/.test(phone)) throw new BadRequestException('contactPhone must be a valid phone number');
  return phone;
}

function validUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) throw new BadRequestException('websiteUrl must be an HTTP or HTTPS URL');
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new Error('invalid');
    return url.toString();
  } catch {
    throw new BadRequestException('websiteUrl must be an HTTP or HTTPS URL');
  }
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]) {
  const unknown = Object.keys(body).find((key) => !allowed.includes(key));
  if (unknown) throw new BadRequestException(`Unsupported field: ${unknown}`);
}
