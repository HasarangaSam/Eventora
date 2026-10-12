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
