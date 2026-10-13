import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  OrganizerApplicationStatus,
  UserRole,
  UserStatus,
} from '../generated/prisma/client.js';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const applicationSelect = {
  id: true,
  status: true,
  organizationName: true,
  description: true,
  contactName: true,
  applicantEmail: true,
  contactPhone: true,
  organizerType: true,
  country: true,
  city: true,
  websiteUrl: true,
  experience: true,
  eventFrequency: true,
  expectedAttendance: true,
  accuracyConfirmed: true,
  rulesAccepted: true,
  rulesVersion: true,
  agreedAt: true,
  eventCategories: { select: { category: { select: { id: true, name: true } } } },
  submittedAt: true,
  reviewedAt: true,
  decisionNote: true,
  applicant: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  reviewer: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} as const;

@Injectable()
export class OrganizerApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(user: User, application: {
    organizationName: string;
    description: string;
    contactName: string;
    contactPhone: string;
    organizerType: 'INDIVIDUAL' | 'COMPANY' | 'EDUCATIONAL_INSTITUTION' | 'NONPROFIT' | 'OTHER';
    country: string;
    city: string;
    websiteUrl: string | null;
    experience: string;
    eventFrequency: 'ONE_TIME' | 'OCCASIONALLY' | 'MONTHLY' | 'FREQUENTLY';
    expectedAttendance: number;
    categoryIds: string[];
  }, verifiedEmail: string) {
    // Friendly checks provide useful errors; the partial unique index remains the concurrency guarantee.
    const approved = await this.prisma.organizerApplication.findFirst({
      where: { applicantId: user.id, status: 'APPROVED' },
      select: { id: true },
    });
    if (approved) throw new ConflictException('This account already has an approved organizer application');

    const pending = await this.prisma.organizerApplication.findFirst({
      where: { applicantId: user.id, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) throw new ConflictException('You already have a pending application');

    const categories = await this.prisma.category.findMany({
      where: { id: { in: application.categoryIds }, isActive: true },
      select: { id: true },
    });
    if (categories.length !== application.categoryIds.length) {
      throw new ConflictException('Choose active Eventora categories');
    }

    try {
      return await this.prisma.organizerApplication.create({
        data: {
          applicantId: user.id,
          applicantEmail: verifiedEmail,
          organizationName: application.organizationName,
          description: application.description,
          contactName: application.contactName,
          contactPhone: application.contactPhone,
          organizerType: application.organizerType,
          country: application.country,
          city: application.city,
          websiteUrl: application.websiteUrl,
          experience: application.experience,
          eventFrequency: application.eventFrequency,
          expectedAttendance: application.expectedAttendance,
          accuracyConfirmed: true,
          rulesAccepted: true,
          rulesVersion: 'organizer-rules-v1',
          agreedAt: new Date(),
          eventCategories: { create: application.categoryIds.map((categoryId) => ({ categoryId })) },
        },
        select: applicationSelect,
      });
    } catch (error) {
      // The partial unique index closes the race between simultaneous submissions.
      if (isUniqueViolation(error)) {
        throw new ConflictException('You already have a pending application');
      }
      throw error;
    }
  }

  getMine(userId: string) {
    return this.prisma.organizerApplication.findMany({
      where: { applicantId: userId },
      orderBy: { submittedAt: 'desc' },
      select: applicationSelect,
    });
  }

  list(status?: OrganizerApplicationStatus) {
    return this.prisma.organizerApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { submittedAt: 'asc' },
      take: 100,
      select: applicationSelect,
    });
  }

  async adminNotifications(adminUserId: string) {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const [pendingApplications, applications, newEventCount, newEvents, cancellationCount, cancellations, paymentExceptionCount, paymentExceptions] = await Promise.all([
      this.prisma.organizerApplication.count({ where: { status: 'PENDING' } }),
      this.prisma.organizerApplication.findMany({
        where: { status: 'PENDING' }, orderBy: { submittedAt: 'desc' }, take: 10,
        select: {
          id: true, organizationName: true, submittedAt: true, city: true, country: true,
          applicant: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.event.count({ where: { createdAt: { gte: since } } }),
      this.prisma.event.findMany({
        where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 10,
        select: { id: true, title: true, status: true, createdAt: true, organizer: { select: { email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.event.count({ where: { status: 'CANCELLED', cancelledAt: { gte: since } } }),
      this.prisma.event.findMany({
        where: { status: 'CANCELLED', cancelledAt: { gte: since } }, orderBy: { cancelledAt: 'desc' }, take: 10,
        select: { id: true, title: true, cancelledAt: true, cancellationReason: true, cancelledBy: { select: { role: true } } },
      }),
      this.prisma.paymentException.count({ where: { createdAt: { gte: since } } }),
      this.prisma.paymentException.findMany({
        where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 10,
        select: { id: true, reasonCode: true, description: true, createdAt: true, registration: { select: { event: { select: { id: true, title: true } } } } },
      }),
    ]);
    const latestNotifications = [
      ...applications.map((application) => ({
        id: `application:${application.id}`, type: 'ORGANIZER_APPLICATION_PENDING', title: 'Organizer application needs review',
        message: `${application.organizationName} has applied to host events.`, createdAt: application.submittedAt,
        location: [application.city, application.country].filter(Boolean).join(', '),
        applicant: { ...application.applicant, name: [application.applicant.firstName, application.applicant.lastName].filter(Boolean).join(' ') || application.applicant.email },
        href: '/admin/applications', actionRequired: true,
      })),
      ...newEvents.map((event) => ({
        id: `event-added:${event.id}`, type: 'EVENT_ADDED', title: 'New event added',
        message: `${event.title} was added by ${[event.organizer.firstName, event.organizer.lastName].filter(Boolean).join(' ') || event.organizer.email}.`,
        createdAt: event.createdAt, location: '', eventStatus: event.status, href: '/admin/events', actionRequired: false,
      })),
      ...cancellations.map((event) => ({
        id: `event-cancelled:${event.id}`, type: 'EVENT_CANCELLED', title: 'Event cancelled',
        message: `${event.title} was cancelled${event.cancellationReason ? `: ${event.cancellationReason}` : '.'}`,
        createdAt: event.cancelledAt!, location: '', eventStatus: 'CANCELLED',
        actorRole: event.cancelledBy?.role ?? 'ORGANIZER', href: '/admin/events', actionRequired: false,
      })),
      ...paymentExceptions.map((exception) => ({
        id: `payment-exception:${exception.id}`, type: 'PAYMENT_EXCEPTION', title: 'Payment needs attention',
        message: `${exception.registration.event.title}: ${exception.reasonCode.replaceAll('_', ' ').toLowerCase()}. ${exception.description.slice(0, 180)}`,
        createdAt: exception.createdAt, location: '', eventId: exception.registration.event.id,
        href: '/admin/payments', actionRequired: true,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 30);
    const readRecords = await this.prisma.adminNotificationRead.findMany({
      where: { adminUserId, notificationId: { in: latestNotifications.map((item) => item.id) } },
      select: { notificationId: true },
    });
    const readIds = new Set(readRecords.map((record) => record.notificationId));
    const notifications = latestNotifications.map((item) => ({ ...item, isRead: readIds.has(item.id) }));
    return {
      pendingApplications,
      notificationCount: pendingApplications + newEventCount + cancellationCount + paymentExceptionCount,
      unreadCount: notifications.filter((item) => !item.isRead).length,
      periodDays: 14,
      notifications,
    };
  }

  async markAdminNotificationsRead(adminUserId: string, notificationIds: string[]) {
    if (notificationIds.length) {
      await this.prisma.adminNotificationRead.createMany({
        data: notificationIds.map((notificationId) => ({ adminUserId, notificationId })),
        skipDuplicates: true,
      });
    }
    return { success: true };
  }

  async getById(id: string) {
    const application = await this.prisma.organizerApplication.findUnique({
      where: { id },
      select: applicationSelect,
    });
    if (!application) throw new NotFoundException('Organizer application not found');
    return application;
  }

  async decide(
    id: string,
    reviewer: User,
    status: 'APPROVED' | 'REJECTED',
    decisionNote: string | null,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const application = await tx.organizerApplication.findUnique({
          where: { id },
          select: { id: true, applicantId: true, status: true },
        });
        if (!application) throw new NotFoundException('Organizer application not found');
        if (application.status !== 'PENDING') {
          throw new ConflictException('This application has already been decided');
        }

        // Conditional update makes a review a single-winner state transition under concurrent admins.
        const update = await tx.organizerApplication.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status,
            reviewerId: reviewer.id,
            reviewedAt: new Date(),
            decisionNote,
          },
        });
        if (update.count !== 1) {
          throw new ConflictException('This application has already been decided');
        }

        if (status === 'APPROVED') {
          const promoted = await tx.user.updateMany({
            where: { id: application.applicantId, status: 'ACTIVE' },
            data: { role: 'ORGANIZER' },
          });
          if (promoted.count !== 1) {
            throw new ConflictException('A deactivated account cannot be approved');
          }
        }

        const applicant = await tx.user.findUniqueOrThrow({
          where: { id: application.applicantId },
          select: { email: true },
        });
        // Queue the decision email in the same transaction as the review and role change.
        await tx.emailDelivery.create({
          data: {
            type: 'ORGANIZER_APPLICATION_DECISION',
            idempotencyKey: `organizer-application-decision:${id}`,
            recipient: applicant.email,
            organizerApplicationId: id,
          },
        });

        return tx.organizerApplication.findUniqueOrThrow({
          where: { id },
          select: applicationSelect,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A decision notification is already queued');
      }
      throw error;
    }
  }

  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async setUserRole(id: string, role: UserRole, actingUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize admin mutations to prevent concurrent changes from removing every active admin.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(584893271004::bigint)`;
      const target = await tx.user.findUnique({ where: { id } });
      if (!target) throw new NotFoundException('User not found');
      if (role === 'ADMIN' && target.status !== 'ACTIVE') {
        throw new ConflictException('A deactivated account cannot become an administrator');
      }
      if (role === 'ORGANIZER') {
        const approvedApplication = await tx.organizerApplication.findFirst({
          where: { applicantId: id, status: 'APPROVED' },
          select: { id: true },
        });
        if (!approvedApplication) {
          throw new ConflictException('An approved organizer application is required for this role');
        }
      }
      if (target.role === 'ADMIN' && role !== 'ADMIN' && target.status === 'ACTIVE') {
        const activeAdmins = await tx.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
        if (activeAdmins <= 1) {
          throw new ConflictException('At least one active administrator must remain');
        }
      }
      // Prevent accidental demotion of the actor from the admin UI.
      if (id === actingUserId && role !== 'ADMIN') {
        throw new ConflictException('Administrators cannot change their own role');
      }
      return tx.user.update({
        where: { id },
        data: { role },
        select: { id: true, email: true, role: true, status: true },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async setUserStatus(id: string, status: UserStatus, actingUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(584893271004::bigint)`;
      const target = await tx.user.findUnique({ where: { id } });
      if (!target) throw new NotFoundException('User not found');
      if (id === actingUserId && status !== 'ACTIVE') {
        throw new ConflictException('Administrators cannot deactivate their own account');
      }
      if (target.role === 'ADMIN' && target.status === 'ACTIVE' && status !== 'ACTIVE') {
        const activeAdmins = await tx.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
        if (activeAdmins <= 1) {
          throw new ConflictException('At least one active administrator must remain');
        }
      }
      return tx.user.update({
        where: { id },
        data: { status },
        select: { id: true, email: true, role: true, status: true },
      });
    }, { isolationLevel: 'Serializable' });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
