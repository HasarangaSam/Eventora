import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { verifyWebhook } from '@clerk/backend/webhooks';
import type { Request as ExpressRequest } from 'express';

@Injectable()
export class ClerkService {
  private client: ClerkClient | undefined;

  constructor(private readonly config: ConfigService) {}

  async authenticate(request: ExpressRequest): Promise<string> {
    const authorization = request.header('authorization');
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) throw new UnauthorizedException('A bearer token is required');

    const clerkRequest = new Request(new URL(request.originalUrl, 'http://localhost'), {
      method: request.method,
      headers: { authorization: `Bearer ${match[1]}` },
    });

    try {
      const frontendOrigin = this.config.get<string>(
        'FRONTEND_ORIGIN',
        'http://localhost:5173',
      );
      const localDevOrigins =
        this.config.get<string>('NODE_ENV') === 'production'
          ? []
          : [
              'http://localhost:5173',
              'http://localhost:5174',
              'http://127.0.0.1:5173',
              'http://127.0.0.1:5174',
            ];

      // Accept only Clerk session tokens issued for this frontend origin.
      const state = await this.getClient().authenticateRequest(clerkRequest, {
        acceptsToken: 'session_token',
        authorizedParties: [...new Set([frontendOrigin, ...localDevOrigins])],
      });
      const userId = state.toAuth()?.userId;
      if (!state.isAuthenticated || !userId) {
        throw new UnauthorizedException('The Clerk session token is invalid or expired');
      }
      return userId;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new UnauthorizedException('The Clerk session token could not be verified');
    }
  }

  async getUser(userId: string) {
    return this.getClient().users.getUser(userId);
  }

  async verifyWebhook(
    request: globalThis.Request,
  ): Promise<Awaited<ReturnType<typeof verifyWebhook>>> {
    const signingSecret = this.config.get<string>('CLERK_WEBHOOK_SIGNING_SECRET');
    if (!signingSecret) {
      throw new ServiceUnavailableException('Clerk webhook signing is not configured');
    }
    return verifyWebhook(request, { signingSecret });
  }

  private getClient(): ClerkClient {
    if (this.client) return this.client;

    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    const publishableKey = this.config.get<string>('CLERK_PUBLISHABLE_KEY');
    if (!secretKey || !publishableKey) {
      throw new ServiceUnavailableException('Clerk backend keys are not configured');
    }

    this.client = createClerkClient({ secretKey, publishableKey });
    return this.client;
  }
}
