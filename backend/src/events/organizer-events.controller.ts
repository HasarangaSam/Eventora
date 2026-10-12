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

@Controller('organizer/events')
@UseGuards(ClerkAuthGuard, AccountGuard, RolesGuard)
@RequireRoles('ORGANIZER')
export class OrganizerEventsController {
  constructor(private readonly events: OrganizerEventsService) {}

  @Get() list(@Req() req: AuthenticatedRequest) { return this.events.list(userId(req)); }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) { return this.events.create(userId(req), eventBody(body, true) as Required<Parameters<OrganizerEventsService['create']>[1]>); }
  @Get(':eventId') get(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) { return this.events.get(userId(req), eventId); }
  @Patch(':eventId') update(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: unknown) { return this.events.update(userId(req), eventId, eventBody(body, false)); }
  @Delete(':eventId') remove(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) { return this.events.remove(userId(req), eventId); }
  @Patch(':eventId/publish') publish(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) { return this.events.publish(userId(req), eventId); }
  @Patch(':eventId/unpublish') unpublish(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) { return this.events.unpublish(userId(req), eventId); }
  @Patch(':eventId/cancel') cancel(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: unknown) { const input = objectBody(body); onlyKeys(input, ['reason']); return this.events.cancel(userId(req), eventId, text(input.reason, 'reason', 5, 1000)); }

  @Post(':eventId/sessions') addSession(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: unknown) { return this.events.addSession(userId(req), eventId, sessionBody(body, true) as Required<Parameters<OrganizerEventsService['addSession']>[2]>); }
  @Patch(':eventId/sessions/:sessionId') updateSession(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Param('sessionId') sessionId: string, @Body() body: unknown) { return this.events.updateSession(userId(req), eventId, sessionId, sessionBody(body, false)); }
  @Delete(':eventId/sessions/:sessionId') removeSession(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Param('sessionId') sessionId: string) { return this.events.removeSession(userId(req), eventId, sessionId); }

  @Post(':eventId/ticket-types') addTicketType(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Body() body: unknown) { return this.events.addTicketType(userId(req), eventId, ticketBody(body, true) as Required<Parameters<OrganizerEventsService['addTicketType']>[2]>); }
  @Patch(':eventId/ticket-types/:ticketTypeId') updateTicketType(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Param('ticketTypeId') ticketTypeId: string, @Body() body: unknown) { return this.events.updateTicketType(userId(req), eventId, ticketTypeId, ticketBody(body, false)); }
  @Patch(':eventId/ticket-types/:ticketTypeId/activation') activateTicketType(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string, @Param('ticketTypeId') ticketTypeId: string, @Body() body: unknown) {
    const active = objectBody(body).isActive;
    if (typeof active !== 'boolean') throw new BadRequestException('isActive must be a boolean');
    return this.events.setTicketTypeActive(userId(req), eventId, ticketTypeId, active);
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
function objectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new BadRequestException('A JSON object is required');
  return value as Record<string, unknown>;
}
function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]) {
  const unknown = Object.keys(body).find((key) => !allowed.includes(key));
  if (unknown) throw new BadRequestException(`Unsupported field: ${unknown}`);
}
function text(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new BadRequestException(`${field} must be between ${min} and ${max} characters`);
  return value.trim();
}
function optionalText(body: Record<string, unknown>, field: string, max: number): string | null | undefined {
  if (!(field in body)) return undefined;
  const value = body[field];
  if (value === null || value === '') return null;
  return text(value, field, 1, max);
}
function date(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new BadRequestException(`${field} must be an ISO timestamp with timezone`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${field} must be a valid ISO timestamp`);
  return parsed;
}
function optionalDate(body: Record<string, unknown>, field: string): Date | null | undefined {
  if (!(field in body)) return undefined;
  return body[field] === null ? null : date(body[field], field);
}
function optionalInteger(body: Record<string, unknown>, field: string): number | undefined {
  if (!(field in body)) return undefined;
  const value = body[field];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new BadRequestException(`${field} must be an integer`);
  return value;
}
function eventBody(value: unknown, create: boolean) {
  const body = objectBody(value);
  onlyKeys(body, ['title', 'description', 'venue', 'city', 'timezone', 'categoryId', 'startAt', 'endAt', 'capacity']);
  const result: Record<string, unknown> = {};
  for (const key of ['title', 'description', 'venue', 'city', 'timezone', 'categoryId'] as const) {
    if (key in body) result[key] = text(body[key], key, 1, key === 'description' ? 20_000 : key === 'title' ? 200 : 200);
  }
  if ('startAt' in body) result.startAt = date(body.startAt, 'startAt');
  if ('endAt' in body) result.endAt = date(body.endAt, 'endAt');
  if ('capacity' in body) result.capacity = body.capacity === null ? null : optionalInteger(body, 'capacity');
  if (create) for (const field of ['title', 'description', 'venue', 'city', 'timezone', 'categoryId', 'startAt', 'endAt'] as const) if (!(field in result)) throw new BadRequestException(`${field} is required`);
  else if (!Object.keys(result).length) throw new BadRequestException('At least one event field is required');
  return result;
}
function sessionBody(value: unknown, create: boolean) {
  const body = objectBody(value); const result: Record<string, unknown> = {};
  onlyKeys(body, ['title', 'description', 'speaker', 'venue', 'startAt', 'endAt']);
  if ('title' in body) result.title = text(body.title, 'title', 1, 200);
  for (const key of ['description', 'speaker', 'venue'] as const) { const parsed = optionalText(body, key, key === 'description' ? 2000 : 200); if (parsed !== undefined) result[key] = parsed; }
  if ('startAt' in body) result.startAt = date(body.startAt, 'startAt');
  if ('endAt' in body) result.endAt = date(body.endAt, 'endAt');
  if (create) for (const field of ['title', 'startAt', 'endAt']) if (!(field in result)) throw new BadRequestException(`${field} is required`);
  else if (!Object.keys(result).length) throw new BadRequestException('At least one session field is required');
  return result;
}
function ticketBody(value: unknown, create: boolean) {
  const body = objectBody(value); const result: Record<string, unknown> = {};
  onlyKeys(body, ['name', 'description', 'price', 'currency', 'quantity', 'salesStartAt', 'salesEndAt', 'isActive']);
  if ('name' in body) result.name = text(body.name, 'name', 1, 120);
  if ('description' in body) result.description = optionalText(body, 'description', 2000);
  if ('price' in body) { if (typeof body.price !== 'string') throw new BadRequestException('price must be a decimal string'); result.price = body.price; }
  if ('currency' in body) result.currency = text(body.currency, 'currency', 3, 3).toUpperCase();
  if ('quantity' in body) result.quantity = optionalInteger(body, 'quantity');
  if ('salesStartAt' in body) result.salesStartAt = optionalDate(body, 'salesStartAt');
  if ('salesEndAt' in body) result.salesEndAt = optionalDate(body, 'salesEndAt');
  if ('isActive' in body) { if (typeof body.isActive !== 'boolean') throw new BadRequestException('isActive must be a boolean'); result.isActive = body.isActive; }
  if (create) for (const field of ['name', 'price', 'currency', 'quantity'] as const) if (!(field in result)) throw new BadRequestException(`${field} is required`);
  else if (!Object.keys(result).length) throw new BadRequestException('At least one ticket type field is required');
  return result;
}
