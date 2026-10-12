import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AccountGuard } from '../auth/account.guard.js';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { TicketsService } from './tickets.service.js';

@Controller('tickets')
@UseGuards(ClerkAuthGuard, AccountGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('me')
  listMine(@Req() request: AuthenticatedRequest) {
    return this.tickets.listMine(request.eventoraUser!.id);
  }

  @Get(':ticketId')
  getMine(@Req() request: AuthenticatedRequest, @Param('ticketId') ticketId: string) {
    return this.tickets.getMine(request.eventoraUser!.id, ticketId);
  }
}
