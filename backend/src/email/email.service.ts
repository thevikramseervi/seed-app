import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const portRaw = this.configService.get<string>('SMTP_PORT');
    const port = portRaw ? parseInt(portRaw, 10) : 587;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.from = this.configService.get<string>('SMTP_FROM') || 'noreply@attendease.local';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: port || 587,
        secure: port === 465,
        pool: true,
        maxConnections: 1,
        rateDelta: 2000,
        rateLimit: 3,
        auth: { user, pass },
      });
    }
  }

  // Shared retry wrapper — handles Gmail's 421 (throttle) and 454 (too many logins)
  private async sendWithRetry(
    mail: nodemailer.SendMailOptions,
    tag: string,
  ): Promise<void> {
    if (!this.transporter) {
      // eslint-disable-next-line no-console
      console.log(`[${tag}] No SMTP configured. Email not sent to ${mail.to}.`);
      return;
    }

    const delays: Record<string, number> = { '421': 5000, '454': 30000 };

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.transporter.sendMail(mail);
        return;
      } catch (err) {
        const msg = (err as Error).message ?? '';
        const code = Object.keys(delays).find((c) => msg.includes(c));

        if (code && attempt < 3) {
          // eslint-disable-next-line no-console
          console.warn(`[${tag}] Gmail ${code} on attempt ${attempt}, retrying in ${delays[code] / 1000}s…`);
          await new Promise((r) => setTimeout(r, delays[code]));
        } else {
          throw err;
        }
      }
    }
  }

  async sendLeaveDecision(params: {
    to: string;
    employeeName: string;
    status: 'APPROVED' | 'REJECTED';
    leaveType: string;
    fromDate: Date;
    toDate: Date;
    comments?: string | null;
  }): Promise<void> {
    const { to, employeeName, status, leaveType, fromDate, toDate, comments } = params;
    const fmt = (d: Date) =>
      `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

    const statusLabel = status === 'APPROVED' ? 'Approved' : 'Rejected';
    const statusColor = status === 'APPROVED' ? '#22c55e' : '#ef4444';
    const leaveLabel = leaveType === 'CASUAL_LEAVE' ? 'CL' : 'Unpaid Leave';
    const subject = `Your ${leaveLabel} Request has been ${statusLabel} – SEED-LAB Attendance System`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#4f46e5;padding:20px 24px;">
          <h2 style="color:#fff;margin:0;font-size:18px;">Leave Request Update</h2>
          <p style="color:#c7d2fe;margin:4px 0 0;font-size:13px;">SEED-LAB Attendance System</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;color:#374151;">Dear <strong>${employeeName}</strong>,</p>
          <p style="margin:0 0 20px;color:#374151;">
            Your <strong>${leaveLabel}</strong> request has been
            <span style="background:${statusColor};color:#fff;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600;">${statusLabel}</span>.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;width:120px;">From</td>
              <td style="padding:6px 0;color:#111827;font-weight:500;">${fmt(fromDate)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">To</td>
              <td style="padding:6px 0;color:#111827;font-weight:500;">${fmt(toDate)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Comments</td>
              <td style="padding:6px 0;color:#374151;">${comments || '—'}</td>
            </tr>
          </table>
        </div>
        <div style="background:#f3f4f6;padding:12px 24px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:11px;">This is an automated message from SEED-LAB Attendance System. Please do not reply.</p>
        </div>
      </div>
    `;

    await this.sendWithRetry({ from: this.from, to, subject, html }, `Leave ${statusLabel}`);
  }

  async sendAnnouncement(params: {
    to: string;
    recipientName: string;
    title: string;
    content: string;
    priority: string;
    postedBy: string;
    postedAt: Date;
  }): Promise<void> {
    const { to, recipientName, title, content, priority, postedBy, postedAt } = params;

    const priorityLabel =
      priority === 'HIGH' ? '🔴 High'
      : priority === 'LOW' ? '🟢 Low'
      : priority === 'URGENT' ? '🚨 Urgent'
      : '🟡 Medium';

    const priorityColor =
      priority === 'HIGH' ? '#ef4444'
      : priority === 'LOW' ? '#22c55e'
      : priority === 'URGENT' ? '#dc2626'
      : '#f59e0b';

    const fmt = (d: Date) =>
      d.toLocaleString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Kolkata',
      });

    const subject = `[Announcement] ${title} – SEED-LAB Attendance System`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#4f46e5;padding:20px 24px;">
          <h2 style="color:#fff;margin:0;font-size:18px;">📢 New Announcement</h2>
          <p style="color:#c7d2fe;margin:4px 0 0;font-size:13px;">SEED-LAB Attendance System</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;color:#374151;">Dear <strong>${recipientName}</strong>,</p>

          <div style="background:#f9fafb;border-left:4px solid #4f46e5;border-radius:4px;padding:16px 20px;margin-bottom:20px;">
            <h3 style="margin:0 0 12px;color:#111827;font-size:16px;">${title}</h3>
            <p style="margin:0;color:#374151;white-space:pre-wrap;line-height:1.6;">${content}</p>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;width:120px;">Priority</td>
              <td style="padding:6px 0;"><span style="background:${priorityColor};color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">${priorityLabel}</span></td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Posted by</td>
              <td style="padding:6px 0;color:#111827;font-weight:500;">${postedBy}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Date &amp; Time</td>
              <td style="padding:6px 0;color:#111827;">${fmt(postedAt)}</td>
            </tr>
          </table>
        </div>
        <div style="background:#f3f4f6;padding:12px 24px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:11px;">This is an automated message from SEED-LAB Attendance System. Please do not reply.</p>
        </div>
      </div>
    `;

    await this.sendWithRetry({ from: this.from, to, subject, html }, 'Announcement email');
  }

  async sendPasswordReset(to: string, resetLink: string): Promise<void> {
    const subject = 'Reset your password – Attend Ease';
    const html = `
      <p>You requested a password reset for your Attend Ease account.</p>
      <p>Click the link below to set a new password. This link expires in 1 hour.</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `;

    if (!this.transporter) {
      const allowLog =
        this.configService.get<string>('DEV_LOG_PASSWORD_RESET_LINK') === 'true' &&
        process.env.NODE_ENV !== 'production';
      // eslint-disable-next-line no-console
      console.log(allowLog ? `[Password reset] Reset link: ${resetLink}` : '[Password reset] No SMTP configured.');
      return;
    }

    await this.sendWithRetry({ from: this.from, to, subject, html }, 'Password reset');
  }
}
