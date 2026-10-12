import {
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClerkService } from './clerk.service.js';
import type { ClerkProfile, ClerkWebhookUser } from './auth.types.js';

export type CurrentUser = Pick<
  User,
  'email' | 'firstName' | 'lastName' | 'imageUrl' | 'role' | 'status'
>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerk: ClerkService,
  ) {}

  async getCurrentUser(clerkUserId: string): Promise<CurrentUser> {
    const profile = await this.clerk.getUser(clerkUserId);
    const user = await this.synchronizeProfile(profile);
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('This Eventora account is deactivated');
    }
    return user;
  }

  async synchronizeWebhookUser(profile: ClerkWebhookUser): Promise<void> {
    await this.synchronizeProfile({
      id: profile.id,
      primaryEmailAddressId: profile.primary_email_address_id,
      emailAddresses: profile.email_addresses.map((email) => ({
        id: email.id,
        emailAddress: email.email_address,
      })),
      firstName: profile.first_name,
      lastName: profile.last_name,
      imageUrl: profile.image_url,
    });
  }

  async deactivateClerkUser(clerkUserId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { clerkUserId },
      data: { status: 'DEACTIVATED' },
    });
  }

  private async synchronizeProfile(profile: ClerkProfile): Promise<CurrentUser> {
    const email = profile.emailAddresses.find(
      (candidate) => candidate.id === profile.primaryEmailAddressId,
    )?.emailAddress;
    if (!email) {
      throw new UnprocessableEntityException(
        'A primary email address is required for an Eventora account',
      );
    }

    // Sync identity fields only; Eventora role and account status remain controlled by the application.
    return this.prisma.user.upsert({
      where: { clerkUserId: profile.id },
      create: {
        clerkUserId: profile.id,
        email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        imageUrl: profile.imageUrl,
      },
      update: {
        email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        imageUrl: profile.imageUrl,
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        role: true,
        status: true,
      },
    });
  }
}
