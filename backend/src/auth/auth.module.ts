import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ClerkService } from './clerk.service.js';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import { AccountGuard } from './account.guard.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, ClerkService, ClerkAuthGuard, AccountGuard, RolesGuard],
  exports: [ClerkService, ClerkAuthGuard, AccountGuard, RolesGuard],
})
export class AuthModule {}
