import { Module } from '@nestjs/common';
import { EventsController } from './events.controller.js';
import { AdminEventsController } from './admin-events.controller.js';
import { EventsService } from './events.service.js';
import { OrganizerEventsController } from './organizer-events.controller.js';
import { OrganizerEventsService } from './organizer-events.service.js';
import { CloudinaryService } from './cloudinary.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { RegistrationsModule } from '../registrations/registrations.module.js';
import { CheckinsController } from '../checkins/checkins.controller.js';
import { CheckinsService } from '../checkins/checkins.service.js';
import { OrganizerNotificationsController } from './organizer-notifications.controller.js';
import { OrganizerNotificationsService } from './organizer-notifications.service.js';

@Module({
  imports: [AuthModule, RegistrationsModule],
  controllers: [EventsController, OrganizerEventsController, OrganizerNotificationsController, AdminEventsController, CheckinsController],
  providers: [EventsService, OrganizerEventsService, OrganizerNotificationsService, CloudinaryService, CheckinsService],
})
export class EventsModule {}
