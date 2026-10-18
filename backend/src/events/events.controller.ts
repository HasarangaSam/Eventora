import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@Query() query: ListEventsQueryDto) {
    const page = positiveInteger(query.page !== undefined ? String(query.page) : undefined, 1, 10_000, 'page');
    const pageSize = positiveInteger(query.pageSize !== undefined ? String(query.pageSize) : undefined, 12, 48, 'pageSize');
    const search = query.search?.trim();
    if (search && search.length > 120) throw new BadRequestException('search must be at most 120 characters');
    if (query.categoryId && query.categoryId.length > 120) {
      throw new BadRequestException('categoryId is invalid');
    }
    const from = parseDate(query.from, 'from');
    const to = parseDate(query.to, 'to');
    if (from && to && from > to) throw new BadRequestException('from must be before or equal to to');

    const sort = query.sort ?? 'startAt';
    if (!['startAt', 'newest', 'title'].includes(sort)) {
      throw new BadRequestException('sort must be startAt, newest, or title');
    }
    const defaultDirection = sort === 'newest' ? 'desc' : 'asc';
    const direction = query.direction ?? defaultDirection;
    if (direction !== 'asc' && direction !== 'desc') {
      throw new BadRequestException('direction must be asc or desc');
    }
    return this.events.list({
      page,
      pageSize,
      search: search || undefined,
      categoryId: query.categoryId,
      from,
      to,
      sort,
      direction,
    });
  }

  @Get('featured')
  featured(@Query('limit') limit?: string) {
    return this.events.featured(positiveInteger(limit, 4, 12, 'limit'));
  }

  @Get(':eventId/sessions')
  sessions(@Param('eventId') id: string) {
    return this.events.sessions(id);
  }

  @Get(':eventId/ticket-types')
  ticketTypes(@Param('eventId') id: string) {
    return this.events.ticketTypes(id);
  }

  @Get(':eventId')
  get(@Param('eventId') id: string) {
    return this.events.get(id);
  }
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number, field: string): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new BadRequestException(`${field} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new BadRequestException(`${field} must be between 1 and ${maximum}`);
  }
  return parsed;
}

function parseDate(value: string | undefined, field: string): Date | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    throw new BadRequestException(`${field} must be a valid ISO date`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${field} must be a valid ISO date`);
  return parsed;
}
