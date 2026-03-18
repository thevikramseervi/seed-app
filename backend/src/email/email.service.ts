import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const portRaw = this.configService.get<string>('SMTP_PORT');
    const port = portRaw ? parseInt(portRaw, 10) : 587;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: port || 587,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  async sendPasswordReset(to: string, resetLink: string): Promise<void> {
    const from =
      this.configService.get<string>('SMTP_FROM') || 'noreply@attendease.local';
    const subject = 'Reset your password – Attend Ease';
    const html = `
      <p>You requested a password reset for your Attend Ease account.</p>
      <p>Click the link below to set a new password. This link expires in 1 hour.</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `;

    if (this.transporter) {
      await this.transporter.sendMail({ from, to, subject, html });
      return;
    }

    // No SMTP configured: avoid leaking reset tokens into logs by default.
    // For local development you can explicitly enable logging the link.
    const allowLog =
      this.configService.get<string>('DEV_LOG_PASSWORD_RESET_LINK') === 'true' &&
      process.env.NODE_ENV !== 'production';

    if (allowLog) {
      // eslint-disable-next-line no-console
      console.log('[Password reset] No SMTP configured. Reset link:', resetLink);
      return;
    }

    // eslint-disable-next-line no-console
    console.log('[Password reset] No SMTP configured. Email not sent.');
  }
}
