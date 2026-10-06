import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    const port = Number(process.env.SMTP_PORT ?? 587);

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendEmailVerificationOtp(email: string, otp: string): Promise<void> {
    const from = process.env.SMTP_FROM;

    if (!from) {
      throw new InternalServerErrorException(
        'Email service is not configured.',
      );
    }

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Verify your Eventora email',
        text: [
          'Welcome to Eventora.',
          '',
          `Your email verification code is: ${otp}`,
          '',
          'This code will expire in 10 minutes.',
          'If you did not create an Eventora account, you can ignore this email.',
        ].join('\n'),
      });
    } catch {
      throw new InternalServerErrorException(
        'Unable to send verification email.',
      );
    }
  }
}
