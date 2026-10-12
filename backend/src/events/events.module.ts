import { Module } from '@nestjs/common';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { OrganizerEventsController } from './organizer-events.controller.js';
import { OrganizerEventsService } from './organizer-events.service.js';
import { CloudinaryService } from './cloudinary.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { RegistrationsModule } from '../registrations/registrations.module.js';

@Module({
  imports: [AuthModule, RegistrationsModule],
  controllers: [EventsController, OrganizerEventsController],
  providers: [EventsService, OrganizerEventsService, CloudinaryService],
})
export class EventsModule {}
