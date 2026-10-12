import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OrganizerApplicationsModule } from './organizer-applications/organizer-applications.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { EventsModule } from './events/events.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, OrganizerApplicationsModule, CategoriesModule, EventsModule],
  controllers: [AppController],
})
export class AppModule {}
