import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EventStatus,
  Prisma,
  EventVisibility,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createSlug } from '../categories/utils/slug.util.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { EventQueryDto } from './dto/event-query.dto.js';

type AuthenticatedUser = {
  id: string;
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
};

@Injectable()
export class EventService {
  private readonly publicStatuses: EventStatus[] = [
    EventStatus.PUBLISHED,
    EventStatus.REGISTRATION_OPEN,
    EventStatus.REGISTRATION_CLOSED,
    EventStatus.ONGOING,
  ];

  private readonly publicDetailStatuses: EventStatus[] = [
    EventStatus.PUBLISHED,
    EventStatus.REGISTRATION_OPEN,
    EventStatus.REGISTRATION_CLOSED,
    EventStatus.ONGOING,
    EventStatus.COMPLETED,
  ];

  private readonly allowedTransitions: Record<
    EventStatus,
    EventStatus[]
  > = {
    [EventStatus.DRAFT]: [
      EventStatus.PUBLISHED,
      EventStatus.CANCELLED,
    ],
    [EventStatus.PUBLISHED]: [
      EventStatus.REGISTRATION_OPEN,
      EventStatus.CANCELLED,
    ],
    [EventStatus.REGISTRATION_OPEN]: [
      EventStatus.REGISTRATION_CLOSED,
      EventStatus.CANCELLED,
    ],
    [EventStatus.REGISTRATION_CLOSED]: [
      EventStatus.ONGOING,
      EventStatus.CANCELLED,
    ],
    [EventStatus.ONGOING]: [
      EventStatus.COMPLETED,
      EventStatus.CANCELLED,
    ],
    [EventStatus.COMPLETED]: [],
    [EventStatus.CANCELLED]: [],
  };

  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateEventDto,
    user: AuthenticatedUser,
  ) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    this.validateDates(startsAt, endsAt);

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    const baseSlug = createSlug(dto.title);

    if (!baseSlug) {
      throw new ConflictException(
        'Event title cannot produce a valid slug.',
      );
    }

    const slug = await this.generateUniqueSlug(baseSlug);

    try {
      return await this.prisma.event.create({
        data: {
          organizerId: user.id,
          categoryId: dto.categoryId,
          title: dto.title.trim(),
          slug,
          description: dto.description.trim(),
          venue: dto.venue.trim(),
          address: dto.address?.trim() || null,
          capacity: dto.capacity,
          startsAt,
          endsAt,
          visibility:
            dto.visibility ?? EventVisibility.PUBLIC,
        },
        select: this.eventManagementSelect,
      });
    } catch (error) {
      this.handleUniqueConstraint(error);
    }
  }

  async findPublic(query: EventQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const search = query.search?.trim();
    const category = query.category?.trim().toLowerCase();

    const where: Prisma.EventWhereInput = {
      visibility: EventVisibility.PUBLIC,
      status: {
        in: this.publicStatuses,
      },
      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(category
        ? {
            category: {
              slug: category,
            },
          }
        : {}),
    };

    const [events, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          startsAt: 'asc',
        },
        select: this.publicEventSelect,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPublicBySlug(slug: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        slug,
        visibility: EventVisibility.PUBLIC,
        status: {
          in: this.publicDetailStatuses,
        },
      },
      select: {
        ...this.publicEventSelect,
        sessions: {
          orderBy: {
            startsAt: 'asc',
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    return event;
  }

  async findMine(user: AuthenticatedUser) {
    const where: Prisma.EventWhereInput =
      user.role === 'ADMIN'
        ? {}
        : {
            organizerId: user.id,
          };

    return this.prisma.event.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      select: this.eventManagementSelect,
    });
  }

  async findByIdForManagement(
    id: string,
    user: AuthenticatedUser,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: this.eventManagementSelect,
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    this.assertCanManage(event.organizerId, user);

    return event;
  }

  async update(
    id: string,
    dto: UpdateEventDto,
    user: AuthenticatedUser,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        organizerId: true,
        title: true,
        categoryId: true,
        capacity: true,
        startsAt: true,
        endsAt: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    this.assertCanManage(event.organizerId, user);

    const startsAt = dto.startsAt
      ? new Date(dto.startsAt)
      : event.startsAt;

    const endsAt = dto.endsAt
      ? new Date(dto.endsAt)
      : event.endsAt;

    this.validateDates(startsAt, endsAt);

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });

      if (!category) {
        throw new NotFoundException('Category not found.');
      }
    }

    const title = dto.title?.trim();

    const slug =
      title && title !== event.title
        ? await this.generateUniqueSlug(createSlug(title), id)
        : undefined;

    try {
      return await this.prisma.event.update({
        where: { id },
        data: {
          ...(title ? { title } : {}),
          ...(slug ? { slug } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(dto.venue !== undefined
            ? { venue: dto.venue.trim() }
            : {}),
          ...(dto.address !== undefined
            ? { address: dto.address?.trim() || null }
            : {}),
          ...(dto.categoryId
            ? { categoryId: dto.categoryId }
            : {}),
          ...(dto.capacity !== undefined
            ? { capacity: dto.capacity }
            : {}),
          ...(dto.startsAt
            ? { startsAt }
            : {}),
          ...(dto.endsAt
            ? { endsAt }
            : {}),
          ...(dto.visibility
            ? { visibility: dto.visibility }
            : {}),
        },
        select: this.eventManagementSelect,
      });
    } catch (error) {
      this.handleUniqueConstraint(error);
    }
  }

  async transitionStatus(
    id: string,
    status: EventStatus,
    user: AuthenticatedUser,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        organizerId: true,
        status: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    this.assertCanManage(event.organizerId, user);

    const allowed =
      this.allowedTransitions[event.status];

    if (!allowed.includes(status)) {
      throw new ConflictException(
        `Event cannot transition from ${event.status} to ${status}.`,
      );
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        status,
      },
      select: this.eventManagementSelect,
    });
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        organizerId: true,
        status: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    this.assertCanManage(event.organizerId, user);

    if (event.status !== EventStatus.DRAFT) {
      throw new ConflictException(
        'Only draft events can be deleted. Cancel the event instead.',
      );
    }

    await this.prisma.event.delete({
      where: { id },
    });

    return {
      message: 'Event deleted successfully.',
    };
  }

  private assertCanManage(
    organizerId: string,
    user: AuthenticatedUser,
  ): void {
    if (user.role === 'ADMIN') {
      return;
    }

    if (
      user.role === 'ORGANIZER' &&
      organizerId === user.id
    ) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to manage this event.',
    );
  }

  private validateDates(
    startsAt: Date,
    endsAt: Date,
  ): void {
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime())
    ) {
      throw new ConflictException(
        'Invalid event dates.',
      );
    }

    if (endsAt <= startsAt) {
      throw new ConflictException(
        'Event end time must be after the start time.',
      );
    }
  }

  private async generateUniqueSlug(
    baseSlug: string,
    excludeEventId?: string,
  ): Promise<string> {
    if (!baseSlug) {
      throw new ConflictException(
        'Event title cannot produce a valid slug.',
      );
    }

    const existing = await this.prisma.event.findMany({
      where: {
        slug: {
          startsWith: baseSlug,
        },
        ...(excludeEventId
          ? {
              NOT: {
                id: excludeEventId,
              },
            }
          : {}),
      },
      select: {
        slug: true,
      },
    });

    const slugs = new Set(
      existing.map((event) => event.slug),
    );

    if (!slugs.has(baseSlug)) {
      return baseSlug;
    }

    let counter = 2;

    while (slugs.has(`${baseSlug}-${counter}`)) {
      counter += 1;
    }

    return `${baseSlug}-${counter}`;
  }

  private handleUniqueConstraint(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'An event with this slug already exists.',
      );
    }

    throw error;
  }

  private readonly publicEventSelect = {
    id: true,
    title: true,
    slug: true,
    description: true,
    venue: true,
    address: true,
    coverImage: true,
    status: true,
    visibility: true,
    capacity: true,
    startsAt: true,
    endsAt: true,
    createdAt: true,
    category: {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    },
  } satisfies Prisma.EventSelect;

  private readonly eventManagementSelect = {
    id: true,
    organizerId: true,
    categoryId: true,
    title: true,
    slug: true,
    description: true,
    venue: true,
    address: true,
    coverImage: true,
    status: true,
    visibility: true,
    capacity: true,
    startsAt: true,
    endsAt: true,
    createdAt: true,
    updatedAt: true,
    category: {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    },
  } satisfies Prisma.EventSelect;
}