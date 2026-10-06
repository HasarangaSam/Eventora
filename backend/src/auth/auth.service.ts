import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { generateOtp, hashOtp } from './utils/otp.util.js';
import {
  generateRefreshToken,
  hashRefreshToken,
} from './utils/refresh-token.util.js';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { JwtPayload } from './types/jwt-payload.type.js';
import { RefreshTokenPayload } from './types/refresh-token-payload.type.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const name = registerDto.name.trim();
    const email = registerDto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await argon2.hash(registerDto.password);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.createEmailVerification(user.id);

    return {
      message: 'Registration successful. Please verify your email.',
      user,
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const email = verifyEmailDto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.emailVerified) {
      return {
        message: 'Email is already verified.',
      };
    }

    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verification) {
      throw new UnauthorizedException(
        'Verification code is invalid or expired.',
      );
    }

    if (verification.expiresAt <= new Date()) {
      throw new UnauthorizedException('Verification code has expired.');
    }

    const maxAttempts = Number(
      this.configService.get<string>('EMAIL_VERIFICATION_MAX_ATTEMPTS', '5'),
    );

    if (verification.attempts >= maxAttempts) {
      throw new UnauthorizedException(
        'Too many verification attempts. Please request a new code.',
      );
    }

    const submittedHash = hashOtp(verifyEmailDto.otp);

    if (submittedHash !== verification.codeHash) {
      await this.prisma.emailVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      throw new UnauthorizedException('Verification code is invalid.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          emailVerified: true,
        },
      }),
      this.prisma.emailVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Email verified successfully.',
    };
  }

  async resendVerification(resendVerificationDto: ResendVerificationDto) {
    const email = resendVerificationDto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.emailVerified) {
      return {
        message: 'Email is already verified.',
      };
    }

    await this.createEmailVerification(user.id);

    return {
      message: 'A new verification code has been sent.',
    };
  }

  async validateLocalUser(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive.');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email first.');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);

    if (!passwordMatches) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
    };
  }

  async login(user: {
    id: string;
    name: string;
    email: string;
    role: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
    emailVerified: boolean;
    isActive: boolean;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const session = await this.createSession(user.id);

    return {
      accessToken,
      refreshToken: session.refreshToken,
      user,
    };
  }

  async createSession(userId: string) {
    const family = await this.prisma.refreshTokenFamily.create({
      data: {
        userId,
      },
    });

    return this.issueRefreshToken(userId, family.id);
  }

  private async issueRefreshToken(userId: string, familyId: string) {
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawRefreshToken);

    const expiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const expiresAt = this.calculateExpiry(expiresIn);

    const refreshToken = await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash,
        expiresAt,
      },
    });

    const refreshPayload = {
      sub: userId,
      familyId,
      tokenId: refreshToken.id,
    };

    const signedRefreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: expiresIn as import('jsonwebtoken').SignOptions['expiresIn'],
    });

    return {
      refreshToken: signedRefreshToken,
      refreshTokenId: refreshToken.id,
    };
  }

  private calculateExpiry(expiresIn: string): Date {
    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) {
      throw new Error(
        'JWT_REFRESH_EXPIRES_IN must use a format such as 15m, 7d, or 30d.',
      );
    }

    const amount = Number(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + amount * multipliers[unit]);
  }

  private async createEmailVerification(userId: string): Promise<void> {
    const otp = generateOtp();
    const codeHash = hashOtp(otp);

    const expiryMinutes = Number(
      this.configService.get<string>(
        'EMAIL_VERIFICATION_OTP_EXPIRY_MINUTES',
        '10',
      ),
    );

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.emailVerification.create({
      data: {
        userId,
        codeHash,
        expiresAt,
      },
    });

    await this.mailService.sendEmailVerificationOtp(user.email, otp);
  }

  async refreshAccessToken(refreshToken: string) {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const tokenHash = hashRefreshToken(refreshToken);

    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{
            id: string;
            userId: string;
            familyId: string;
            tokenHash: string;
            expiresAt: Date;
            revokedAt: Date | null;
            replacedBy: string | null;
            familyRevokedAt: Date | null;
            userName: string;
            userEmail: string;
            userRole: 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
            userEmailVerified: boolean;
            userIsActive: boolean;
          }>
        >(Prisma.sql`
          SELECT
            rt.id,
            rt."userId",
            rt."familyId",
            rt."tokenHash",
            rt."expiresAt",
            rt."revokedAt",
            rt."replacedBy",
            rtf."revokedAt" AS "familyRevokedAt",
            u.name AS "userName",
            u.email AS "userEmail",
            u.role AS "userRole",
            u."emailVerified" AS "userEmailVerified",
            u."isActive" AS "userIsActive"
          FROM "RefreshToken" rt
          INNER JOIN "RefreshTokenFamily" rtf
            ON rtf.id = rt."familyId"
          INNER JOIN "User" u
            ON u.id = rt."userId"
          WHERE rt."tokenHash" = ${tokenHash}
          FOR UPDATE OF rt, rtf
        `);

        const storedToken = rows[0];

        if (!storedToken) {
          throw new UnauthorizedException('Invalid refresh token.');
        }

        if (storedToken.id !== payload.tokenId) {
          throw new UnauthorizedException('Invalid refresh token.');
        }

        if (storedToken.familyId !== payload.familyId) {
          throw new UnauthorizedException('Invalid refresh token.');
        }

        if (storedToken.expiresAt <= new Date()) {
          throw new UnauthorizedException('Refresh token has expired.');
        }

        if (storedToken.familyRevokedAt) {
          throw new UnauthorizedException('Refresh token family is revoked.');
        }

        if (storedToken.revokedAt) {
          await tx.refreshTokenFamily.update({
            where: {
              id: storedToken.familyId,
            },
            data: {
              revokedAt: new Date(),
            },
          });

          throw new UnauthorizedException(
            'Refresh token reuse detected. Session revoked.',
          );
        }

        if (!storedToken.userIsActive) {
          await tx.refreshTokenFamily.update({
            where: {
              id: storedToken.familyId,
            },
            data: {
              revokedAt: new Date(),
            },
          });

          throw new UnauthorizedException('User account is inactive.');
        }

        const newRawRefreshToken = generateRefreshToken();
        const newTokenHash = hashRefreshToken(newRawRefreshToken);

        const expiresIn = this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        );

        const newExpiresAt = this.calculateExpiry(expiresIn);

        const newRefreshToken = await tx.refreshToken.create({
          data: {
            userId: storedToken.userId,
            familyId: storedToken.familyId,
            tokenHash: newTokenHash,
            expiresAt: newExpiresAt,
          },
        });

        await tx.refreshToken.update({
          where: {
            id: storedToken.id,
          },
          data: {
            revokedAt: new Date(),
            replacedBy: newRefreshToken.id,
          },
        });

        const refreshPayload: RefreshTokenPayload = {
          sub: storedToken.userId,
          familyId: storedToken.familyId,
          tokenId: newRefreshToken.id,
        };

        const signedRefreshToken = await this.jwtService.signAsync(
          refreshPayload,
          {
            secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
            expiresIn:
              expiresIn as import('jsonwebtoken').SignOptions['expiresIn'],
          },
        );

        const accessPayload: JwtPayload = {
          sub: storedToken.userId,
          email: storedToken.userEmail,
          role: storedToken.userRole,
        };

        const accessToken = await this.jwtService.signAsync(accessPayload);

        return {
          accessToken,
          refreshToken: signedRefreshToken,
          user: {
            id: storedToken.userId,
            name: storedToken.userName,
            email: storedToken.userEmail,
            role: storedToken.userRole,
            emailVerified: storedToken.userEmailVerified,
            isActive: storedToken.userIsActive,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  async logout(refreshToken: string): Promise<void> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const tokenHash = hashRefreshToken(refreshToken);

    await this.prisma.$transaction(async (tx) => {
      const storedToken = await tx.refreshToken.findUnique({
        where: {
          tokenHash,
        },
      });

      if (!storedToken || storedToken.id !== payload.tokenId) {
        throw new UnauthorizedException('Invalid refresh token.');
      }

      if (storedToken.familyId !== payload.familyId) {
        throw new UnauthorizedException('Invalid refresh token.');
      }

      if (storedToken.revokedAt) {
        return;
      }

      await tx.refreshToken.update({
        where: {
          id: storedToken.id,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshTokenFamily.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);
  }
}
