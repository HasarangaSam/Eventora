import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { LocalStrategy } from './strategies/local.strategy.js';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const accessSecret = configService.get<string>('JWT_ACCESS_SECRET');

        const refreshSecret = configService.get<string>('JWT_REFRESH_SECRET');

        if (!accessSecret) {
          throw new Error('JWT_ACCESS_SECRET is not configured.');
        }

        if (!refreshSecret) {
          throw new Error('JWT_REFRESH_SECRET is not configured.');
        }

        return {
          secret: accessSecret,
          signOptions: {
            expiresIn: configService.get<string>(
              'JWT_ACCESS_EXPIRES_IN',
              '15m',
            ) as import('jsonwebtoken').SignOptions['expiresIn'],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
})
export class AuthModule {}
