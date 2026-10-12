import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrganizerApplicationsController } from './organizer-applications.controller.js';
import { OrganizerApplicationsService } from './organizer-applications.service.js';

@Module({
  imports: [AuthModule],
  controllers: [OrganizerApplicationsController],
  providers: [OrganizerApplicationsService],
})
export class OrganizerApplicationsModule {}
