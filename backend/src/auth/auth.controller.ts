import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service.js';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import { ClerkService } from './clerk.service.js';
import type { AuthenticatedRequest, ClerkWebhookUser } from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly clerk: ClerkService,
  ) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  getMe(@Req() request: AuthenticatedRequest) {
    return this.auth.getCurrentUser(request.clerkUserId);
  }

  @Post('webhooks/clerk')
  @HttpCode(200)
  async clerkWebhook(@Req() request: RawBodyRequest<ExpressRequest>) {
    if (!request.rawBody) {
      throw new ServiceUnavailableException('Raw request body is required for webhook verification');
    }

    const headers = new Headers();
    for (const name of [
      'webhook-id',
      'webhook-timestamp',
      'webhook-signature',
      'svix-id',
      'svix-timestamp',
      'svix-signature',
    ]) {
      const value = request.header(name);
      if (value) headers.set(name, value);
    }
    const webhookRequest = new Request(new URL(request.originalUrl, 'http://localhost'), {
      method: request.method,
      headers,
      body: new Uint8Array(request.rawBody),
    });

    let event;
    try {
      event = await this.clerk.verifyWebhook(webhookRequest);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new BadRequestException('Clerk webhook signature verification failed');
    }

    if (event.type === 'user.created' || event.type === 'user.updated') {
      await this.auth.synchronizeWebhookUser(event.data as ClerkWebhookUser);
    } else if (event.type === 'user.deleted') {
      const clerkUserId = event.data.id;
      if (!clerkUserId) {
        throw new BadRequestException('Clerk deletion webhook is missing the user ID');
      }
      await this.auth.deactivateClerkUser(clerkUserId);
    }

    return { received: true };
  }
}
