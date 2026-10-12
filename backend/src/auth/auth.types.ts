import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  clerkUserId: string;
}

export interface ClerkProfile {
  id: string;
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
}

export interface ClerkWebhookUser {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: Array<{ id: string; email_address: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
}

