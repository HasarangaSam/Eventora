import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
@UseGuards(ClerkAuthGuard, AccountGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':registrationId/checkout')
  checkout(@Req() request: AuthenticatedRequest, @Param('registrationId') registrationId: string, @Body() body: unknown) {
    const input = objectBody(body);
    onlyKeys(input, ['firstName', 'lastName', 'phone', 'address', 'city', 'country']);
    return this.payments.createCheckout(request.eventoraUser!.id, registrationId, {
      firstName: text(input.firstName, 'firstName', 1, 100),
      lastName: text(input.lastName, 'lastName', 1, 100),
      phone: text(input.phone, 'phone', 5, 32),
      address: text(input.address, 'address', 1, 200),
      city: text(input.city, 'city', 1, 100),
      country: text(input.country, 'country', 2, 80),
    });
  }

  @Get('me')
  listMine(@Req() request: AuthenticatedRequest) {
    return this.payments.listMine(request.eventoraUser!.id);
  }

  @Get(':paymentId')
  getMine(@Req() request: AuthenticatedRequest, @Param('paymentId') paymentId: string) {
    return this.payments.getMine(request.eventoraUser!.id, paymentId);
  }
}

@Controller('webhooks/payhere')
export class PayHereWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('notify')
  @HttpCode(200)
  notify(@Body() body: unknown) {
    return this.payments.handleNotification(objectBody(body));
  }
}

function objectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new BadRequestException('A form-encoded object is required');
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
