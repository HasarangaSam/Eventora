import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RegistrationsModule } from '../registrations/registrations.module.js';
import { PaymentsController, PayHereWebhookController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [AuthModule, RegistrationsModule, EmailModule],
  controllers: [PaymentsController, PayHereWebhookController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
