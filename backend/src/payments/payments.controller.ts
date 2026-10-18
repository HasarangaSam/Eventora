import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PaymentsService } from './payments.service.js';
import { CheckoutDto } from './dto/checkout.dto.js';
import { ensureDto } from '../common/validation/dto-validator.js';

@Controller('payments')
@UseGuards(ClerkAuthGuard, AccountGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':registrationId/checkout')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  checkout(@Req() request: AuthenticatedRequest, @Param('registrationId') registrationId: string, @Body() body: CheckoutDto) {
    const dto = ensureDto(CheckoutDto, body);
    return this.payments.createCheckout(request.eventoraUser!.id, registrationId, {
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      phone: dto.phone.trim(),
      address: dto.address.trim(),
      city: dto.city.trim(),
      country: dto.country.trim(),
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
@SkipThrottle()
export class PayHereWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('notify')
  @HttpCode(200)
  notify(@Body() body: unknown) {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BadRequestException('A form-encoded object is required');
    }
    return this.payments.handleNotification(body as Record<string, unknown>);
  }
}
