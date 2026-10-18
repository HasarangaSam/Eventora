import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RegistrationsService } from './registrations.service.js';
import { CreateRegistrationDto } from './dto/create-registration.dto.js';
import { ensureDto } from '../common/validation/dto-validator.js';

@Controller('registrations')
@UseGuards(ClerkAuthGuard, AccountGuard)
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateRegistrationDto,
  ) {
    const dto = ensureDto(CreateRegistrationDto, body);
    if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key header must be 8 to 128 letters, numbers, dots, underscores, colons, or hyphens');
    }
    return this.registrations.create(request.eventoraUser!.id, dto.ticketTypeId.trim(), dto.quantity, idempotencyKey);
  }

  @Get('me')
  listMine(@Req() request: AuthenticatedRequest) {
    return this.registrations.listMine(request.eventoraUser!.id);
  }

  @Get(':registrationId')
  getMine(@Req() request: AuthenticatedRequest, @Param('registrationId') registrationId: string) {
    return this.registrations.getMine(request.eventoraUser!.id, registrationId);
  }
}
