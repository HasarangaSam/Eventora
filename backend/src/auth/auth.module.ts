import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ClerkService } from './clerk.service.js';
import { ClerkAuthGuard } from './clerk-auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, ClerkService, ClerkAuthGuard],
})
export class AuthModule {}
