import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRegistrationDto } from './dto/create-registration.dto.js';
import { Prisma, RegistrationStatus } from '../generated/prisma/client.js';

type AuthenticatedUser = {
  id: string;
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
  emailVerified: boolean;
  isActive: boolean;
};

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRegistrationDto, user: AuthenticatedUser) {
    if (!user.isActive) {
      throw new ForbiddenException('Your account is not active.');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email before registering for an event.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const ticketTypeRows = await tx.$queryRaw<
          Array<{
            id: string;
            eventId: string;
            quantity: number;
            soldQuantity: number;
            price: Prisma.Decimal;
            eventCapacity: number;
            eventStatus: string;
          }>
        >(Prisma.sql`
            SELECT
              tt.id,
              tt."eventId",
              tt.quantity,
              tt."soldQuantity",
              tt.price,
              e.capacity AS "eventCapacity",
              e.status AS "eventStatus"
            FROM "TicketType" tt
            INNER JOIN "Event" e
              ON e.id = tt."eventId"
            WHERE tt.id = ${dto.ticketTypeId}
            FOR UPDATE OF tt, e
          `);

        const ticketType = ticketTypeRows[0];

        if (!ticketType) {
          throw new NotFoundException('Ticket type not found.');
        }

        if (ticketType.eventStatus !== 'REGISTRATION_OPEN') {
          throw new ConflictException(
            'Registration is not currently open for this event.',
          );
        }

        const existingRegistration = await tx.registration.findFirst({
          where: {
            userId: user.id,
            eventId: ticketType.eventId,
            status: 'CONFIRMED',
          },
          select: {
            id: true,
          },
        });

        if (existingRegistration) {
          throw new ConflictException(
            'You already have an active registration for this event.',
          );
        }

        const availableTickets = ticketType.quantity - ticketType.soldQuantity;

        if (dto.quantity > availableTickets) {
          throw new ConflictException(
            `Only ${availableTickets} ticket(s) are available.`,
          );
        }

        const eventSoldRows = await tx.$queryRaw<
          Array<{
            total: bigint | null;
          }>
        >(Prisma.sql`
            SELECT COALESCE(SUM(r.quantity), 0)::bigint AS total
            FROM "Registration" r
            WHERE r."eventId" = ${ticketType.eventId}
              AND r.status = 'CONFIRMED'
          `);

        const eventSold = Number(eventSoldRows[0]?.total ?? 0n);

        if (eventSold + dto.quantity > ticketType.eventCapacity) {
          throw new ConflictException(
            'There are not enough event capacity slots available.',
          );
        }

        const registration = await tx.registration.create({
          data: {
            userId: user.id,
            eventId: ticketType.eventId,
            ticketTypeId: ticketType.id,
            quantity: dto.quantity,
            status: RegistrationStatus.CONFIRMED,
          },
        });

        await tx.ticketType.update({
          where: {
            id: ticketType.id,
          },
          data: {
            soldQuantity: {
              increment: dto.quantity,
            },
          },
        });

        const tickets = Array.from({ length: dto.quantity }, () => ({
          registrationId: registration.id,
          eventId: ticketType.eventId,
          ticketTypeId: ticketType.id,
          ticketNumber: this.generateTicketNumber(),
          qrToken: this.generateQrToken(),
        }));

        await tx.ticket.createMany({
          data: tickets,
        });

        return tx.registration.findUniqueOrThrow({
          where: {
            id: registration.id,
          },
          select: {
            id: true,
            eventId: true,
            ticketTypeId: true,
            quantity: true,
            status: true,
            registeredAt: true,
            ticketType: {
              select: {
                name: true,
                price: true,
              },
            },
            event: {
              select: {
                id: true,
                title: true,
                slug: true,
                venue: true,
                startsAt: true,
                endsAt: true,
              },
            },
            tickets: {
              select: {
                id: true,
                ticketNumber: true,
                qrToken: true,
                status: true,
              },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  async findMine(userId: string) {
    return this.prisma.registration.findMany({
      where: {
        userId,
      },
      orderBy: {
        registeredAt: 'desc',
      },
      select: {
        id: true,
        eventId: true,
        ticketTypeId: true,
        quantity: true,
        status: true,
        registeredAt: true,
        cancelledAt: true,
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            venue: true,
            startsAt: true,
            endsAt: true,
          },
        },
        ticketType: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        tickets: {
          select: {
            id: true,
            ticketNumber: true,
            qrToken: true,
            status: true,
          },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        eventId: true,
        ticketTypeId: true,
        quantity: true,
        status: true,
        registeredAt: true,
        cancelledAt: true,
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            venue: true,
            address: true,
            startsAt: true,
            endsAt: true,
          },
        },
        ticketType: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        tickets: {
          select: {
            id: true,
            ticketNumber: true,
            qrToken: true,
            status: true,
            checkedInAt: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found.');
    }

    if (registration.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this registration.',
      );
    }

    return registration;
  }

  async cancel(id: string, userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const registration = await tx.registration.findUnique({
          where: { id },
          select: {
            id: true,
            userId: true,
            eventId: true,
            ticketTypeId: true,
            quantity: true,
            status: true,
            cancelledAt: true,
          },
        });

        if (!registration) {
          throw new NotFoundException('Registration not found.');
        }

        if (registration.userId !== userId) {
          throw new ForbiddenException(
            'You do not have permission to cancel this registration.',
          );
        }

        const lockedData = await tx.$queryRaw<
          Array<{
            eventId: string;
            eventStatus: string;
            startsAt: Date;
            ticketTypeId: string;
            soldQuantity: number;
            registrationId: string;
            registrationStatus: string;
            registrationQuantity: number;
          }>
        >`
          SELECT
            e.id AS "eventId",
            e.status AS "eventStatus",
            e."startsAt" AS "startsAt",
            tt.id AS "ticketTypeId",
            tt."soldQuantity" AS "soldQuantity",
            r.id AS "registrationId",
            r.status AS "registrationStatus",
            r.quantity AS "registrationQuantity"
          FROM "Registration" r
          INNER JOIN "Event" e
            ON e.id = r."eventId"
          INNER JOIN "TicketType" tt
            ON tt.id = r."ticketTypeId"
          WHERE r.id = ${id}
          FOR UPDATE OF r, e, tt
        `;

        const locked = lockedData[0];

        if (!locked) {
          throw new NotFoundException('Registration not found.');
        }

        if (locked.registrationStatus !== 'CONFIRMED') {
          throw new ConflictException(
            'Registration has already been cancelled.',
          );
        }

        const now = new Date();

        if (locked.startsAt <= now) {
          throw new ConflictException(
            'Registration can no longer be cancelled because the event has started.',
          );
        }

        if (
          locked.eventStatus === 'ONGOING' ||
          locked.eventStatus === 'COMPLETED' ||
          locked.eventStatus === 'CANCELLED'
        ) {
          throw new ConflictException(
            'Registration cannot be cancelled in the current event state.',
          );
        }

        if (locked.soldQuantity < locked.registrationQuantity) {
          throw new ConflictException(
            'Ticket inventory is inconsistent. Registration cannot be cancelled.',
          );
        }

        const checkedInTicket = await tx.ticket.findFirst({
          where: {
            registrationId: id,
            status: 'CHECKED_IN',
          },
          select: {
            id: true,
          },
        });

        if (checkedInTicket) {
          throw new ConflictException(
            'A checked-in ticket cannot be cancelled.',
          );
        }

        const updatedRegistration = await tx.registration.update({
          where: {
            id,
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                slug: true,
                startsAt: true,
                endsAt: true,
              },
            },
            ticketType: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
            tickets: {
              select: {
                id: true,
                ticketNumber: true,
                qrToken: true,
                status: true,
                checkedInAt: true,
              },
            },
          },
        });

        await tx.ticketType.update({
          where: {
            id: locked.ticketTypeId,
          },
          data: {
            soldQuantity: {
              decrement: locked.registrationQuantity,
            },
          },
        });

        await tx.ticket.updateMany({
          where: {
            registrationId: id,
            status: 'VALID',
          },
          data: {
            status: 'CANCELLED',
          },
        });

        return {
          message: 'Registration cancelled successfully.',
          registration: updatedRegistration,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  private generateTicketNumber(): string {
    return `EVT-${randomBytes(8).toString('hex').toUpperCase()}`;
  }

  private generateQrToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
