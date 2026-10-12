import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RegistrationsService } from './registrations.service.js';

@Controller('registrations')
@UseGuards(ClerkAuthGuard, AccountGuard)
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    const input = objectBody(body);
    onlyKeys(input, ['ticketTypeId', 'quantity']);
    const ticketTypeId = text(input.ticketTypeId, 'ticketTypeId', 1, 120);
    const quantity = input.quantity;
    if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2_147_483_647) {
      throw new BadRequestException('quantity must be a positive integer');
    }
    if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key header must be 8 to 128 letters, numbers, dots, underscores, colons, or hyphens');
    }
    return this.registrations.create(request.eventoraUser!.id, ticketTypeId, quantity, idempotencyKey);
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

function objectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new BadRequestException('A JSON object is required');
  return value as Record<string, unknown>;
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]) {
  const unknown = Object.keys(body).find((key) => !allowed.includes(key));
  if (unknown) throw new BadRequestException(`Unsupported field: ${unknown}`);
}

function text(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new BadRequestException(`${field} must be between ${min} and ${max} characters`);
  }
  return value.trim();
}
