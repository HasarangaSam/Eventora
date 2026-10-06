import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RegistrationService } from './registration.service.js';
import { CreateRegistrationDto } from './dto/create-registration.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

type AuthenticatedUser = {
  id: string;
  role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
  emailVerified: boolean;
  isActive: boolean;
};

@Controller('registrations')
@UseGuards(JwtAuthGuard)
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post()
  create(
    @Body() dto: CreateRegistrationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationService.create(dto, user);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.registrationService.findMine(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.registrationService.findOne(id, user.id);
  }
}
