import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CloudinaryService } from './cloudinary.service.js';
import { InventoryService } from '../registrations/inventory.service.js';

const ownerDetails = {
  category: { select: { id: true, name: true, slug: true } },
  sessions: { orderBy: { startAt: 'asc' as const } },
  ticketTypes: { orderBy: { createdAt: 'asc' as const } },
};

type EventInput = {
  title?: string; categoryId?: string; description?: string; venue?: string; city?: string;
  startAt?: Date; endAt?: Date; timezone?: string; capacity?: number | null;
};
type CreateEventInput = { title: string; categoryId: string; description: string; venue: string; city: string; startAt: Date; endAt: Date; timezone: string; capacity?: number | null };
type SessionInput = { title?: string; description?: string | null; speaker?: string | null; venue?: string | null; startAt?: Date; endAt?: Date };
type TicketInput = { name?: string; description?: string | null; price?: string | Prisma.Decimal; currency?: string; quantity?: number; salesStartAt?: Date | null; salesEndAt?: Date | null; isActive?: boolean };
export type UploadedImage = { buffer: Buffer; mimetype: string };

@Injectable()
export class OrganizerEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly inventory: InventoryService,
  ) {}

  list(organizerId: string) {
    return this.prisma.event.findMany({ where: { organizerId }, orderBy: { updatedAt: 'desc' }, include: ownerDetails });
  }

  async listForAdmin(query: { status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'; search?: string; page: number; pageSize: number }) {
    const term = query.search?.trim() ?? '';
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(term ? { OR: [
        { title: { contains: term, mode: 'insensitive' as const } },
        { city: { contains: term, mode: 'insensitive' as const } },
        { venue: { contains: term, mode: 'insensitive' as const } },
        { organizer: { email: { contains: term, mode: 'insensitive' as const } } },
        { organizer: { firstName: { contains: term, mode: 'insensitive' as const } } },
        { organizer: { lastName: { contains: term, mode: 'insensitive' as const } } },
      ] } : {}),
    };
    const select = {
        id: true, title: true, slug: true, city: true, venue: true, startAt: true, endAt: true, status: true,
        ticketsReserved: true, ticketsSold: true,
        updatedAt: true, cancelledAt: true, cancellationReason: true,
        organizer: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { registrations: true, tickets: true } },
    } as const;
    const [items, total] = await Promise.all([
      this.prisma.event.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select }),
      this.prisma.event.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize, pageCount: Math.ceil(total / query.pageSize) };
  }

  getForAdmin(eventId: string) {
    return this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        category: { select: { id: true, name: true } }, sessions: { orderBy: { startAt: 'asc' } },
        ticketTypes: { orderBy: { createdAt: 'asc' } },
        organizer: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
        _count: { select: { registrations: true, tickets: true, reservations: true, checkIns: true } },
      },
    }).then((event) => {
      if (!event) throw new NotFoundException('Event not found');
      return event;
    });
  }

  async get(organizerId: string, eventId: string) {
    await this.owned(organizerId, eventId);
    return this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: ownerDetails });
  }

  async readiness(organizerId: string, eventId: string) {
    const event = await this.owned(organizerId, eventId);
    const details = await this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: { ticketTypes: true, category: true } });
    const readiness = this.getPublishReadiness(event, details);
    const history = await this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { _count: { select: { registrations: true, reservations: true } } } });
    const canUnpublish = event.status === 'PUBLISHED'
      && history._count.registrations === 0
      && history._count.reservations === 0
      && event.ticketsReserved === 0
      && event.ticketsSold === 0;
    return {
      ...readiness,
      canUnpublish,
      unpublishBlocker: event.status === 'PUBLISHED' && !canUnpublish
        ? 'Attendee or ticket history prevents returning this event to draft.'
        : null,
    };
  }

  async create(organizerId: string, input: CreateEventInput) {
    validateEventDates(input.startAt, input.endAt, input.timezone);
    if (input.capacity !== undefined && input.capacity !== null && (!Number.isSafeInteger(input.capacity) || input.capacity < 1)) throw new BadRequestException('capacity must be a positive integer or null');
    const category = await this.prisma.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } });
    if (!category) throw new BadRequestException('An active category is required');
    const baseSlug = slugify(input.title);
    if (!baseSlug) throw new BadRequestException('title must contain letters or numbers');
    // Retry only slug collisions; a bounded suffix loop avoids hiding unrelated database errors.
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt ? `${baseSlug}-${randomSuffix()}` : baseSlug;
      try {
        return await this.prisma.event.create({ data: { ...input, slug, organizerId }, include: ownerDetails });
      } catch (error) {
        if (!isUnique(error)) throw error;
      }
    }
    throw new ConflictException('Could not create a unique event URL; try again');
  }

  async update(organizerId: string, eventId: string, input: EventInput) {
    const event = await this.owned(organizerId, eventId);
    if (event.status === 'CANCELLED' || event.status === 'COMPLETED') throw new ConflictException('This event can no longer be edited');
    if (!Object.keys(input).length) throw new BadRequestException('At least one event field is required');
    if (input.startAt || input.endAt || input.timezone) {
      validateEventDates(input.startAt ?? event.startAt, input.endAt ?? event.endAt, input.timezone ?? event.timezone);
    }
    if (input.categoryId) {
      const category = await this.prisma.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } });
      if (!category) throw new BadRequestException('An active category is required');
    }
    const counts = await this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { _count: { select: { registrations: true, reservations: true } } } });
    const hasHistory = counts._count.registrations > 0 || counts._count.reservations > 0;
    if (hasHistory && ['title', 'categoryId', 'venue', 'city', 'startAt', 'endAt', 'timezone', 'capacity'].some((field) => field in input)) {
      throw new ConflictException('Event details affecting existing registrations or inventory cannot be changed');
    }
    if (event.status === 'PUBLISHED' && ['title', 'categoryId', 'venue', 'city', 'startAt', 'endAt', 'timezone', 'capacity'].some((field) => field in input)) {
      throw new ConflictException('Unpublish the event before changing its public details');
    }
    if (input.capacity !== undefined) {
      if (input.capacity !== null && (!Number.isSafeInteger(input.capacity) || input.capacity < 1)) throw new BadRequestException('capacity must be a positive integer or null');
      if (input.capacity !== null && input.capacity < event.ticketsReserved + event.ticketsSold) throw new ConflictException('capacity cannot be lower than reserved and sold tickets');
    }
    const data: Prisma.EventUpdateInput = { ...input };
    if (input.title) {
      data.slug = slugify(input.title);
      if (!data.slug) throw new BadRequestException('title must contain letters or numbers');
    }
    try {
      return await this.prisma.event.update({ where: { id: eventId }, data, include: ownerDetails });
    } catch (error) {
      if (isUnique(error)) throw new ConflictException('An event with that URL already exists');
      throw error;
    }
  }

  async publish(organizerId: string, eventId: string) {
    const event = await this.owned(organizerId, eventId);
    const details = await this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: { ticketTypes: true, category: true } });
    if (event.status !== 'DRAFT') throw new ConflictException('Only draft events can be published');
    const readiness = this.getPublishReadiness(event, details);
    if (!readiness.ready) throw new BadRequestException({ code: 'EVENT_NOT_READY', message: 'This event needs changes before it can be published.', issues: readiness.issues });
    return this.prisma.event.update({ where: { id: eventId }, data: { status: 'PUBLISHED', publishedAt: new Date() }, include: ownerDetails });
  }

  private getPublishReadiness(event: { title: string; description: string; venue: string; city: string; startAt: Date; endAt: Date; capacity: number | null; ticketsReserved: number; ticketsSold: number }, details: { category: { isActive: boolean }; ticketTypes: Array<{ isActive: boolean; price: Prisma.Decimal; quantity: number; quantityReserved: number; quantitySold: number; salesStartAt: Date | null; salesEndAt: Date | null }> }) {
    const now = new Date();
    const issues: { field: string; code: string; message: string }[] = [];
    if (!event.title.trim()) issues.push({ field: 'title', code: 'TITLE_REQUIRED', message: 'Add an event title.' });
    if (!event.description.trim()) issues.push({ field: 'description', code: 'DESCRIPTION_REQUIRED', message: 'Add an event description.' });
    if (!event.venue.trim() || !event.city.trim()) issues.push({ field: 'location', code: 'LOCATION_REQUIRED', message: 'Add the venue and city.' });
    if (!details.category.isActive) issues.push({ field: 'categoryId', code: 'CATEGORY_UNAVAILABLE', message: 'Choose an active event category.' });
    if (event.startAt <= now || event.endAt <= event.startAt) issues.push({ field: 'startAt', code: 'INVALID_EVENT_DATES', message: 'Set a future event start and an end time after the start.' });
    if (event.capacity !== null && event.capacity < event.ticketsReserved + event.ticketsSold) issues.push({ field: 'capacity', code: 'CAPACITY_TOO_LOW', message: 'Event capacity is below tickets already reserved or sold.' });
    const paidTicketAvailable = details.ticketTypes.some((ticket) => ticket.isActive && ticket.price.greaterThan(0)
      && ticket.quantity - ticket.quantityReserved - ticket.quantitySold > 0
      && (!ticket.salesStartAt || ticket.salesStartAt <= now)
      && (!ticket.salesEndAt || ticket.salesEndAt > now));
    if (!paidTicketAvailable) issues.push({ field: 'ticketTypes', code: 'NO_AVAILABLE_PAID_TICKETS', message: 'Add or activate a paid ticket tier with remaining inventory that is on sale now.' });
    return { ready: issues.length === 0, issues };
  }

  async unpublish(organizerId: string, eventId: string) {
    const event = await this.owned(organizerId, eventId);
    const counts = await this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { _count: { select: { registrations: true, reservations: true } } } });
    if (event.status !== 'PUBLISHED') throw new ConflictException('Only published events can be unpublished');
    if (counts._count.registrations || counts._count.reservations || event.ticketsReserved || event.ticketsSold) {
      throw new ConflictException('An event with registrations or inventory commitments cannot be unpublished; cancel it instead');
    }
    return this.prisma.event.update({ where: { id: eventId }, data: { status: 'DRAFT' }, include: ownerDetails });
  }

  async cancel(organizerId: string, eventId: string, reason: string) {
    const event = await this.owned(organizerId, eventId);
    return this.cancelEvent(organizerId, eventId, event.status, reason);
  }

  async cancelAsAdmin(adminId: string, eventId: string, reason: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true, status: true } });
    if (!event) throw new NotFoundException('Event not found');
    return this.cancelEvent(adminId, eventId, event.status, reason);
  }

  private async cancelEvent(actorId: string, eventId: string, currentStatus: string, reason: string) {
    if (currentStatus === 'CANCELLED' || currentStatus === 'COMPLETED') throw new ConflictException('This event cannot be cancelled in its current state');
    const now = new Date();
    // Cancel the event and release its outstanding reservations as one database change.
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.event.updateMany({
        where: { id: eventId, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        data: { status: 'CANCELLED', cancelledAt: now, cancelledById: actorId, cancellationReason: reason },
      });
      if (changed.count !== 1) throw new ConflictException('This event cannot be cancelled in its current state');
      await this.inventory.releaseEventReservations(tx, eventId);
    });
    return { id: eventId, status: 'CANCELLED' };
  }

  async remove(organizerId: string, eventId: string) {
    const event = await this.owned(organizerId, eventId);
    const counts = await this.prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { _count: { select: { registrations: true, reservations: true, tickets: true, checkIns: true } } } });
    if (counts._count.registrations || counts._count.reservations || counts._count.tickets || counts._count.checkIns || event.ticketsSold || event.ticketsReserved) {
      throw new ConflictException('Events with registration, payment, ticket, or inventory history cannot be deleted');
    }
    if (event.coverImagePublicId) throw new ConflictException('Remove the event cover image before deleting this event');
    await this.prisma.$transaction(async (tx) => {
      await tx.eventSession.deleteMany({ where: { eventId } });
      await tx.ticketType.deleteMany({ where: { eventId } });
      await tx.event.delete({ where: { id: eventId } });
    });
    return { deleted: true };
  }

  async addSession(organizerId: string, eventId: string, input: Required<SessionInput>) {
    const event = await this.editable(organizerId, eventId);
    validateSession(input, event.startAt, event.endAt);
    return this.prisma.eventSession.create({ data: { ...input, eventId } });
  }

  async updateSession(organizerId: string, eventId: string, sessionId: string, input: SessionInput) {
    const event = await this.editable(organizerId, eventId);
    if (!Object.keys(input).length) throw new BadRequestException('At least one session field is required');
    if (await this.hasRegistrationHistory(eventId)) throw new ConflictException('Schedule entries cannot be changed after registrations exist');
    const session = await this.prisma.eventSession.findFirst({ where: { id: sessionId, eventId } });
    if (!session) throw new NotFoundException('Session not found');
    const merged = { ...session, ...input };
    validateSession(merged, event.startAt, event.endAt);
    return this.prisma.eventSession.update({ where: { id: sessionId }, data: input });
  }

  async removeSession(organizerId: string, eventId: string, sessionId: string) {
    const event = await this.editable(organizerId, eventId);
    const session = await this.prisma.eventSession.findFirst({ where: { id: sessionId, eventId }, select: { id: true } });
    if (!session) throw new NotFoundException('Session not found');
    if (event.ticketsSold || event.ticketsReserved || await this.hasRegistrationHistory(eventId)) throw new ConflictException('Schedule entries cannot be removed after registrations or ticket commitments exist');
    await this.prisma.eventSession.delete({ where: { id: sessionId } });
    return { deleted: true };
  }

  async addTicketType(organizerId: string, eventId: string, input: Required<TicketInput>) {
    const event = await this.editable(organizerId, eventId);
    validateTicket(input, event.startAt);
    if (event.capacity !== null && input.quantity > event.capacity - event.ticketsReserved - event.ticketsSold) throw new BadRequestException('Ticket quantity exceeds remaining event capacity');
    try { return await this.prisma.ticketType.create({ data: { ...input, eventId } }); }
    catch (error) { if (isUnique(error)) throw new ConflictException('Ticket type name already exists for this event'); throw error; }
  }

  async updateTicketType(organizerId: string, eventId: string, ticketTypeId: string, input: TicketInput) {
    const event = await this.editable(organizerId, eventId);
    if (!Object.keys(input).length) throw new BadRequestException('At least one ticket type field is required');
    const ticket = await this.prisma.ticketType.findFirst({ where: { id: ticketTypeId, eventId } });
    if (!ticket) throw new NotFoundException('Ticket type not found');
    const merged = { ...ticket, ...input };
    validateTicket(merged, event.startAt);
    if (input.quantity !== undefined && input.quantity < ticket.quantityReserved + ticket.quantitySold) throw new ConflictException('Quantity cannot be lower than reserved and sold tickets');
    const hasCommitments = ticket.quantityReserved > 0 || ticket.quantitySold > 0;
    // Prices and identifying terms are historical once a reservation or sale refers to this type.
    if (hasCommitments && ['name', 'price', 'currency', 'salesStartAt', 'salesEndAt'].some((field) => field in input)) {
      throw new ConflictException('Ticket terms cannot change after reservations or sales; deactivate the type instead');
    }
    if (event.capacity !== null && input.quantity !== undefined && input.quantity > ticket.quantity + event.capacity - event.ticketsReserved - event.ticketsSold) {
      throw new BadRequestException('Ticket quantity exceeds remaining event capacity');
    }
    try { return await this.prisma.ticketType.update({ where: { id: ticketTypeId }, data: input }); }
    catch (error) { if (isUnique(error)) throw new ConflictException('Ticket type name already exists for this event'); throw error; }
  }

  async removeTicketType(organizerId: string, eventId: string, ticketTypeId: string) {
    await this.editable(organizerId, eventId);
    const ticket = await this.prisma.ticketType.findFirst({ where: { id: ticketTypeId, eventId }, select: { id: true, quantityReserved: true, quantitySold: true, _count: { select: { registrations: true, reservations: true, tickets: true } } } });
    if (!ticket) throw new NotFoundException('Ticket type not found');
    if (ticket.quantityReserved || ticket.quantitySold || ticket._count.registrations || ticket._count.reservations || ticket._count.tickets) {
      throw new ConflictException('Ticket types with history cannot be deleted; deactivate them instead');
    }
    await this.prisma.ticketType.delete({ where: { id: ticketTypeId } });
    return { deleted: true };
  }

  async setTicketTypeActive(organizerId: string, eventId: string, ticketTypeId: string, isActive: boolean) {
    await this.editable(organizerId, eventId);
    const ticket = await this.prisma.ticketType.findFirst({ where: { id: ticketTypeId, eventId }, select: { id: true } });
    if (!ticket) throw new NotFoundException('Ticket type not found');
    return this.prisma.ticketType.update({ where: { id: ticketTypeId }, data: { isActive } });
  }

  async replaceCover(organizerId: string, eventId: string, file: UploadedImage) {
    const event = await this.editable(organizerId, eventId);
    const detected = detectImage(file.buffer);
    if (!detected || detected !== file.mimetype) throw new BadRequestException('Only valid JPEG, PNG, and WebP images are accepted');
    const uploaded = await this.cloudinary.upload(file.buffer, detected);
    try {
      await this.prisma.event.update({ where: { id: eventId }, data: { coverImageUrl: uploaded.url, coverImagePublicId: uploaded.publicId } });
    } catch (error) {
      await this.cloudinary.destroy(uploaded.publicId).catch(() => undefined);
      throw error;
    }
    if (event.coverImagePublicId) {
      try {
        await this.cloudinary.destroy(event.coverImagePublicId);
      } catch (error) {
        // Keep the old asset authoritative if its deletion fails, and remove the replacement.
        await this.prisma.event.update({ where: { id: eventId }, data: { coverImageUrl: event.coverImageUrl, coverImagePublicId: event.coverImagePublicId } });
        await this.cloudinary.destroy(uploaded.publicId).catch(() => undefined);
        throw error;
      }
    }
    return { coverImageUrl: uploaded.url };
  }

  async deleteCover(organizerId: string, eventId: string) {
    const event = await this.editable(organizerId, eventId);
    if (!event.coverImagePublicId) return { deleted: false };
    await this.prisma.event.update({ where: { id: eventId }, data: { coverImageUrl: null, coverImagePublicId: null } });
    try {
      await this.cloudinary.destroy(event.coverImagePublicId);
    } catch (error) {
      await this.prisma.event.update({ where: { id: eventId }, data: { coverImageUrl: event.coverImageUrl, coverImagePublicId: event.coverImagePublicId } });
      throw error;
    }
    return { deleted: true };
  }

  private async editable(organizerId: string, eventId: string) {
    const event = await this.owned(organizerId, eventId);
    if (event.status === 'CANCELLED' || event.status === 'COMPLETED') throw new ConflictException('This event can no longer be edited');
    return event;
  }

  private async hasRegistrationHistory(eventId: string) {
    const count = await this.prisma.event.count({ where: { id: eventId, registrations: { some: {} } } });
    return count > 0;
  }

  private async owned(organizerId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, organizerId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
}

function validateEventDates(startAt: Date, endAt: Date, timezone: string) {
  if (!(startAt instanceof Date) || !(endAt instanceof Date) || !Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt <= new Date() || endAt <= startAt) {
    throw new BadRequestException('Event start must be in the future and end must be after start');
  }
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw new BadRequestException('timezone must be a valid IANA timezone'); }
}

function validateSession(session: SessionInput, eventStart: Date, eventEnd: Date) {
  if (!session.title?.trim() || session.title.trim().length > 200 || !session.startAt || !session.endAt || session.startAt < eventStart || session.endAt > eventEnd || session.endAt <= session.startAt) {
    throw new BadRequestException('Session title and times are required; session times must be within the event schedule');
  }
}

function validateTicket(ticket: TicketInput, eventStart: Date) {
  if (!ticket.name?.trim() || ticket.name.trim().length > 120) throw new BadRequestException('Ticket type name is required and must be at most 120 characters');
  if (ticket.price === undefined || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(String(ticket.price)) || Number(ticket.price) <= 0) throw new BadRequestException('Ticket price must be a positive amount with at most two decimal places');
  if (!ticket.currency || !/^[A-Z]{3}$/.test(ticket.currency)) throw new BadRequestException('currency must be a three-letter uppercase code');
  if (!Number.isSafeInteger(ticket.quantity) || (ticket.quantity ?? 0) < 1) throw new BadRequestException('quantity must be a positive integer');
  if (ticket.salesStartAt && ticket.salesStartAt >= eventStart) throw new BadRequestException('Ticket sales must start before the event begins');
  if (ticket.salesStartAt && ticket.salesEndAt && ticket.salesEndAt <= ticket.salesStartAt) throw new BadRequestException('salesEndAt must be after salesStartAt');
  if (ticket.salesEndAt && ticket.salesEndAt > eventStart) throw new BadRequestException('Ticket sales must end by the event start time');
  if (ticket.isActive !== undefined && typeof ticket.isActive !== 'boolean') throw new BadRequestException('isActive must be a boolean');
  if (ticket.description !== undefined && ticket.description !== null && ticket.description.length > 2000) throw new BadRequestException('description must be at most 2000 characters');
}

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 220); }
function randomSuffix() { return Math.random().toString(36).slice(2, 8); }
function isUnique(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }

function detectImage(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
