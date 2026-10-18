import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EventsService } from './events.service.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';

class FeaturedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a positive integer' })
  @Min(1, { message: 'limit must be between 1 and 12' })
  @Max(12, { message: 'limit must be between 1 and 12' })
  limit?: number = 4;
}

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@Query() query: ListEventsQueryDto) {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from must be before or equal to to');
    }
    const sort = query.sort ?? 'startAt';
    const defaultDirection = sort === 'newest' ? 'desc' : 'asc';
    return this.events.list({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 12,
      search: query.search?.trim() || undefined,
      categoryId: query.categoryId,
      from: query.from,
      to: query.to,
      sort,
      direction: query.direction ?? defaultDirection,
    });
  }

  @Get('featured')
  featured(@Query() query: FeaturedQueryDto) {
    return this.events.featured(query.limit ?? 4);
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
