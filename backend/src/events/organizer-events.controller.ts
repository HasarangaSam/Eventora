import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseFilePipeBuilder,
  Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import { RequireRoles, RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OrganizerEventsService, type UploadedImage } from './organizer-events.service.js';
import {
  CreateEventDto,
  CreateSessionDto,
  CreateTicketTypeDto,
  SetTicketTypeActiveDto,
  UpdateEventDto,
  UpdateSessionDto,
  UpdateTicketTypeDto,
} from './dto/event.dto.js';
import { CancelEventDto } from './dto/cancel-event.dto.js';
import { ensureDto } from '../common/validation/dto-validator.js';

@Controller('organizer/events')
@UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
@RequireRoles('ORGANIZER')
export class OrganizerEventsController {
  constructor(private readonly events: OrganizerEventsService) {}

  @Get() list(@Req() req: AuthenticatedRequest) { return this.events.list(userId(req)); }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateEventDto) {
    const dto = ensureDto(CreateEventDto, body);
    return this.events.create(userId(req), {
      title: dto.title.trim(),
      categoryId: dto.categoryId.trim(),
      description: dto.description.trim(),
      venue: dto.venue.trim(),
      city: dto.city.trim(),
      startAt: dto.startAt,         // already a Date from @IsIsoTimestamp
      endAt: dto.endAt,
      timezone: dto.timezone.trim(),
      capacity: dto.capacity ?? null,
    });
  }

  @Get(':eventId') get(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) { return this.events.get(userId(req), eventId); }

  @Patch(':eventId')
  update(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: UpdateEventDto) {
    const dto = ensureDto(UpdateEventDto, body);
    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.venue !== undefined) data.venue = dto.venue.trim();
    if (dto.city !== undefined) data.city = dto.city.trim();
    if (dto.timezone !== undefined) data.timezone = dto.timezone.trim();
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId.trim();
    if (dto.startAt !== undefined) data.startAt = dto.startAt;  // already a Date
    if (dto.endAt !== undefined) data.endAt = dto.endAt;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (!Object.keys(data).length) throw new BadRequestException('At least one event field is required');
    return this.events.update(userId(req), eventId, data);
  }

  @Delete(':eventId') remove(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) { return this.events.remove(userId(req), eventId); }
  @Patch(':eventId/publish') publish(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) { return this.events.publish(userId(req), eventId); }
  @Patch(':eventId/unpublish') unpublish(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) { return this.events.unpublish(userId(req), eventId); }

  @Patch(':eventId/cancel')
  cancel(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: CancelEventDto) {
    const dto = ensureDto(CancelEventDto, body);
    return this.events.cancel(userId(req), eventId, dto.reason.trim());
  }

  @Post(':eventId/sessions')
  addSession(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: CreateSessionDto) {
    const dto = ensureDto(CreateSessionDto, body);
    return this.events.addSession(userId(req), eventId, {
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      speaker: dto.speaker?.trim() || null,
      venue: dto.venue?.trim() || null,
      startAt: dto.startAt,         // already a Date
      endAt: dto.endAt,
    } as Required<Parameters<OrganizerEventsService['addSession']>[2]>);
  }

  @Patch(':eventId/sessions/:sessionId')
  updateSession(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Param('sessionId') sessionId: string, @Body() body: UpdateSessionDto) {
    const dto = ensureDto(UpdateSessionDto, body);
    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.speaker !== undefined) data.speaker = dto.speaker?.trim() || null;
    if (dto.venue !== undefined) data.venue = dto.venue?.trim() || null;
    if (dto.startAt !== undefined) data.startAt = dto.startAt;  // already a Date
    if (dto.endAt !== undefined) data.endAt = dto.endAt;
    if (!Object.keys(data).length) throw new BadRequestException('At least one session field is required');
    return this.events.updateSession(userId(req), eventId, sessionId, data);
  }

  @Delete(':eventId/sessions/:sessionId') removeSession(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Param('sessionId') sessionId: string) { return this.events.removeSession(userId(req), eventId, sessionId); }

  @Post(':eventId/ticket-types')
  addTicketType(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: CreateTicketTypeDto) {
    const dto = ensureDto(CreateTicketTypeDto, body);
    return this.events.addTicketType(userId(req), eventId, {
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      price: dto.price,
      currency: dto.currency.trim().toUpperCase(),
      quantity: dto.quantity,
      salesStartAt: dto.salesStartAt ?? null,   // already Date | null from DTO
      salesEndAt: dto.salesEndAt ?? null,
      isActive: dto.isActive,
    } as Required<Parameters<OrganizerEventsService['addTicketType']>[2]>);
  }

  @Patch(':eventId/ticket-types/:ticketTypeId')
  updateTicketType(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Param('ticketTypeId') ticketTypeId: string, @Body() body: UpdateTicketTypeDto) {
    const dto = ensureDto(UpdateTicketTypeDto, body);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.currency !== undefined) data.currency = dto.currency.trim().toUpperCase();
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.salesStartAt !== undefined) data.salesStartAt = dto.salesStartAt; // already Date | null
    if (dto.salesEndAt !== undefined) data.salesEndAt = dto.salesEndAt;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (!Object.keys(data).length) throw new BadRequestException('At least one ticket type field is required');
    return this.events.updateTicketType(userId(req), eventId, ticketTypeId, data);
  }

  @Patch(':eventId/ticket-types/:ticketTypeId/activation')
  activateTicketType(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Param('ticketTypeId') ticketTypeId: string, @Body() body: SetTicketTypeActiveDto) {
    const dto = ensureDto(SetTicketTypeActiveDto, body);
    return this.events.setTicketTypeActive(userId(req), eventId, ticketTypeId, dto.isActive);
  }

  @Delete(':eventId/ticket-types/:ticketTypeId') removeTicketType(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Param('ticketTypeId') ticketTypeId: string) { return this.events.removeTicketType(userId(req), eventId, ticketTypeId); }

  @Post(':eventId/cover-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new BadRequestException('Only JPEG, PNG, and WebP images are accepted'), false);
    callback(null, true);
  } }))
  replaceCover(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @UploadedFile(new ParseFilePipeBuilder().addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 }).build({ fileIsRequired: true })) file: UploadedImage) {
    return this.events.replaceCover(userId(req), eventId, file);
  }

  @Delete(':eventId/cover-image') deleteCover(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) { return this.events.deleteCover(userId(req), eventId); }
}

function userId(req: AuthenticatedRequest) { if (!req.eventoraUser) throw new BadRequestException('Authenticated account is required'); return req.eventoraUser.id; }
