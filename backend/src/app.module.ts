import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OrganizerApplicationsModule } from './organizer-applications/organizer-applications.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { EventsModule } from './events/events.module.js';
import { RegistrationsModule } from './registrations/registrations.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { EmailModule } from './email/email.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AppThrottlerGuard } from './auth/app-throttler.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'burst',
        ttl: 1000,
        limit: 15,
      },
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    EmailModule,
    TicketsModule,
    AnalyticsModule,
    AuthModule,
    OrganizerApplicationsModule,
    CategoriesModule,
    EventsModule,
    RegistrationsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
