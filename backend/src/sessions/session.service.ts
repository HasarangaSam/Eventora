import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpdateSessionDto } from './dto/update-session.dto.js';

type AuthenticatedUser = {
  id: string;
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
};

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEvent(eventId: string, user?: AuthenticatedUser) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizerId: true,
        status: true,
        visibility: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    if (user) {
      this.assertCanManage(event.organizerId, user);
    } else {
      if (
        event.visibility !== 'PUBLIC' ||
        event.status === 'DRAFT' ||
        event.status === 'CANCELLED'
      ) {
        throw new NotFoundException('Event not found.');
      }
    }

    return this.prisma.eventSession.findMany({
      where: {
        eventId,
      },
      orderBy: {
        startsAt: 'asc',
      },
      select: {
        id: true,
        eventId: true,
        title: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(
    eventId: string,
    dto: CreateSessionDto,
    user: AuthenticatedUser,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizerId: true,
        startsAt: true,
        endsAt: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    this.assertCanManage(event.organizerId, user);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    this.validateDates(startsAt, endsAt, event.startsAt, event.endsAt);

    return this.prisma.eventSession.create({
      data: {
        eventId,
        title: dto.title.trim(),
        startsAt,
        endsAt,
      },
      select: {
        id: true,
        eventId: true,
        title: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateSessionDto, user: AuthenticatedUser) {
    const session = await this.prisma.eventSession.findUnique({
      where: { id },
      select: {
        id: true,
        eventId: true,
        title: true,
        startsAt: true,
        endsAt: true,
        event: {
          select: {
            organizerId: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    this.assertCanManage(session.event.organizerId, user);

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : session.startsAt;

    const endsAt = dto.endsAt ? new Date(dto.endsAt) : session.endsAt;

    this.validateDates(
      startsAt,
      endsAt,
      session.event.startsAt,
      session.event.endsAt,
    );

    return this.prisma.eventSession.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.startsAt ? { startsAt } : {}),
        ...(dto.endsAt ? { endsAt } : {}),
      },
      select: {
        id: true,
        eventId: true,
        title: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const session = await this.prisma.eventSession.findUnique({
      where: { id },
      select: {
        id: true,
        event: {
          select: {
            organizerId: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    this.assertCanManage(session.event.organizerId, user);

    await this.prisma.eventSession.delete({
      where: { id },
    });

    return {
      message: 'Session deleted successfully.',
    };
  }

  private assertCanManage(organizerId: string, user: AuthenticatedUser): void {
    if (user.role === 'ADMIN') {
      return;
    }

    if (user.role === 'ORGANIZER' && organizerId === user.id) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to manage this event.',
    );
  }

  private validateDates(
    startsAt: Date,
    endsAt: Date,
    eventStartsAt: Date,
    eventEndsAt: Date,
  ): void {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new ConflictException('Invalid session dates.');
    }

    if (endsAt <= startsAt) {
      throw new ConflictException(
        'Session end time must be after the start time.',
      );
    }

    if (startsAt < eventStartsAt) {
      throw new ConflictException('Session cannot start before the event.');
    }

    if (endsAt > eventEndsAt) {
      throw new ConflictException('Session cannot end after the event.');
    }
  }
}
