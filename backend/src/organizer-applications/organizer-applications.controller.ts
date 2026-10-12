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
  UseGuards,
} from '@nestjs/common';
import type { OrganizerApplicationStatus, UserRole, UserStatus } from '../generated/prisma/client.js';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OrganizerApplicationsService } from './organizer-applications.service.js';

@Controller()
@UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
export class OrganizerApplicationsController {
  constructor(private readonly applications: OrganizerApplicationsService) {}

  @Post('organizer-applications')
  @RequireRoles('ATTENDEE')
  submit(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = objectBody(body);
    return this.applications.submit(
      request.eventoraUser!,
      textField(input, 'organizationName', 2, 200),
      textField(input, 'description', 20, 5000),
    );
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
