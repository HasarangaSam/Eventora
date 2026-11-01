import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { TicketsService } from './tickets.service.js';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto.js';

@Controller('tickets')
@UseGuards(ClerkAuthGuard, AccountGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('me')
  listMine(@Req() request: AuthenticatedRequest, @Query() query: ListTicketsQueryDto) {
    return this.tickets.listMine(request.eventoraUser!.id, query);
  }

  @Get(':ticketId')
  getMine(@Req() request: AuthenticatedRequest, @Param('ticketId') ticketId: string) {
    return this.tickets.getMine(request.eventoraUser!.id, ticketId);
  }
}
