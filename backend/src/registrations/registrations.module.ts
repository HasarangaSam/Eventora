import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InventoryService } from './inventory.service.js';
import { RegistrationsController } from './registrations.controller.js';
import { RegistrationsService } from './registrations.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RegistrationsController],
  providers: [InventoryService, RegistrationsService],
  exports: [InventoryService],
})
export class RegistrationsModule {}
