import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { User } from '../generated/prisma/client.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import type { ClerkService } from '../auth/clerk.service.js';
import { OrganizerApplicationsController } from './organizer-applications.controller.js';
import type { OrganizerApplicationsService } from './organizer-applications.service.js';

describe('OrganizerApplicationsController', () => {
  const user = { id: 'user-1', clerkUserId: 'clerk-1', email: 'verified@example.com' } as User;
  const request = { clerkUserId: 'clerk-1', eventoraUser: user } as AuthenticatedRequest;
  const body = {
    organizationName: 'Community events', description: 'I want to organize events for my community.',
    contactName: 'Applicant Name', contactPhone: '+94770000000',
    organizerType: 'INDIVIDUAL' as const,
    country: 'Sri Lanka', city: 'Colombo', websiteUrl: '', experience: 'I am a beginner organizer.',
    eventFrequency: 'ONE_TIME' as const, expectedAttendance: 80, categoryIds: ['category-1'],
    accuracyConfirmed: true, rulesAccepted: true,
  };

  it('uses the verified primary email from Clerk and submits the validated application details', async () => {
    const submit = vi.fn().mockResolvedValue({ id: 'application-1' });
    const applications = { submit } as unknown as OrganizerApplicationsService;
    const clerk = { getUser: vi.fn().mockResolvedValue({ primaryEmailAddress: {
      emailAddress: 'verified@example.com', verification: { status: 'verified' },
    } }) } as unknown as ClerkService;
    const controller = new OrganizerApplicationsController(applications, clerk);

    await expect(controller.submit(request, body)).resolves.toEqual({ id: 'application-1' });
    expect(submit).toHaveBeenCalledWith(user, expect.objectContaining({
      organizationName: 'Community events', categoryIds: ['category-1'],
    }), 'verified@example.com');
  });

  it('rejects applications with an unverified Clerk email', async () => {
    const submit = vi.fn();
    const applications = { submit } as unknown as OrganizerApplicationsService;
    const clerk = { getUser: vi.fn().mockResolvedValue({ primaryEmailAddress: {
      emailAddress: 'pending@example.com', verification: { status: 'unverified' },
    } }) } as unknown as ClerkService;
    const controller = new OrganizerApplicationsController(applications, clerk);

    await expect(controller.submit(request, body)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(submit).not.toHaveBeenCalled();
  });

  it('does not accept a client-supplied applicant email or unchecked agreements', async () => {
    const controller = new OrganizerApplicationsController({} as OrganizerApplicationsService, {} as ClerkService);

    await expect(controller.submit(request, { ...body, applicantEmail: 'spoof@example.com' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.submit(request, { ...body, rulesAccepted: false })).rejects.toBeInstanceOf(BadRequestException);
  });
});
