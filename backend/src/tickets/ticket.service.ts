import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto.js';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto.js';

type AuthenticatedUser = {
  id: string;
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
};

@Injectable()
export class TicketService {
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
    } else if (
      event.visibility !== 'PUBLIC' ||
      event.status === 'DRAFT' ||
      event.status === 'CANCELLED'
    ) {
      throw new NotFoundException('Event not found.');
    }

    return this.prisma.ticketType.findMany({
      where: {
        eventId,
      },
      orderBy: {
        price: 'asc',
      },
      select: {
        id: true,
        eventId: true,
        name: true,
        description: true,
        price: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(
    eventId: string,
    dto: CreateTicketTypeDto,
    user: AuthenticatedUser,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizerId: true,
        capacity: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    this.assertCanManage(event.organizerId, user);

    const totalQuantity = await this.prisma.ticketType.aggregate({
      where: {
        eventId,
      },
      _sum: {
        quantity: true,
      },
    });

    const currentQuantity = totalQuantity._sum.quantity ?? 0;

    if (currentQuantity + dto.quantity > event.capacity) {
      throw new ConflictException(
        'Ticket quantities cannot exceed event capacity.',
      );
    }

    const existing = await this.prisma.ticketType.findFirst({
      where: {
        eventId,
        name: {
          equals: dto.name.trim(),
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A ticket type with this name already exists for this event.',
      );
    }

    return this.prisma.ticketType.create({
      data: {
        eventId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        price: dto.price,
        quantity: dto.quantity,
      },
      select: {
        id: true,
        eventId: true,
        name: true,
        description: true,
        price: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateTicketTypeDto, user: AuthenticatedUser) {
    const ticketType = await this.prisma.ticketType.findUnique({
      where: { id },
      select: {
        id: true,
        eventId: true,
        name: true,
        quantity: true,
        event: {
          select: {
            organizerId: true,
            capacity: true,
          },
        },
      },
    });

    if (!ticketType) {
      throw new NotFoundException('Ticket type not found.');
    }

    this.assertCanManage(ticketType.event.organizerId, user);

    const newName = dto.name?.trim();

    if (newName && newName.toLowerCase() !== ticketType.name.toLowerCase()) {
      const existing = await this.prisma.ticketType.findFirst({
        where: {
          eventId: ticketType.eventId,
          id: {
            not: id,
          },
          name: {
            equals: newName,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        throw new ConflictException(
          'A ticket type with this name already exists for this event.',
        );
      }
    }

    if (dto.quantity !== undefined) {
      const otherQuantity = await this.prisma.ticketType.aggregate({
        where: {
          eventId: ticketType.eventId,
          id: {
            not: id,
          },
        },
        _sum: {
          quantity: true,
        },
      });

      const totalOtherQuantity = otherQuantity._sum.quantity ?? 0;

      if (totalOtherQuantity + dto.quantity > ticketType.event.capacity) {
        throw new ConflictException(
          'Ticket quantities cannot exceed event capacity.',
        );
      }
    }

    return this.prisma.ticketType.update({
      where: { id },
      data: {
        ...(newName
          ? {
              name: newName,
            }
          : {}),
        ...(dto.description !== undefined
          ? {
              description: dto.description.trim() || null,
            }
          : {}),
        ...(dto.price !== undefined
          ? {
              price: dto.price,
            }
          : {}),
        ...(dto.quantity !== undefined
          ? {
              quantity: dto.quantity,
            }
          : {}),
      },
      select: {
        id: true,
        eventId: true,
        name: true,
        description: true,
        price: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const ticketType = await this.prisma.ticketType.findUnique({
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

    if (!ticketType) {
      throw new NotFoundException('Ticket type not found.');
    }

    this.assertCanManage(ticketType.event.organizerId, user);

    await this.prisma.ticketType.delete({
      where: { id },
    });

    return {
      message: 'Ticket type deleted successfully.',
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
}
