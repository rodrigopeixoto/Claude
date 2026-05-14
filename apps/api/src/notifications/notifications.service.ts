import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class NotificationsService {
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly webUrl: string;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY', '');
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!apiKey) this.logger.warn('RESEND_API_KEY not set — emails will be skipped');
    this.from = config.get<string>('EMAIL_FROM', 'noreply@meetscheduler.com');
    this.webUrl = config.get<string>('WEB_URL', 'http://localhost:3000');
  }

  async sendInvite(email: string, name: string | null, meeting: any, token: string) {
    if (!this.resend) return;
    const inviteUrl = `${this.webUrl}/invite/${token}`;
    const subject = `You're invited to: ${meeting.title}`;

    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject,
        html: this.buildInviteHtml(name, meeting, inviteUrl),
      });
    } catch (err) {
      this.logger.warn(`Failed to send invite email to ${email}: ${err.message}`);
    }
  }

  async sendConfirmation(email: string, name: string | null, meeting: any) {
    if (!this.resend) return;
    const subject = `Meeting confirmed: ${meeting.title}`;
    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject,
        html: this.buildConfirmationHtml(name, meeting),
      });
    } catch (err) {
      this.logger.warn(`Failed to send confirmation email to ${email}: ${err.message}`);
    }
  }

  private buildInviteHtml(name: string | null, meeting: any, inviteUrl: string): string {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Meeting Invitation</h2>
        <p>Hi ${name || 'there'},</p>
        <p>You have been invited to <strong>${meeting.title}</strong>.</p>
        ${meeting.description ? `<p>${meeting.description}</p>` : ''}
        <p>To help find the best time for everyone, please connect your calendar anonymously — we only check your availability, never your event details.</p>
        <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">
          Connect My Calendar
        </a>
        <p style="color:#6B7280;font-size:12px;margin-top:32px;">
          This link expires in 7 days. Your calendar data is only used to find available times — no event details are stored.
        </p>
      </div>
    `;
  }

  private buildConfirmationHtml(name: string | null, meeting: any): string {
    const slot = meeting.confirmedSlotStart
      ? new Date(meeting.confirmedSlotStart).toLocaleString()
      : '';
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Meeting Confirmed!</h2>
        <p>Hi ${name || 'there'},</p>
        <p><strong>${meeting.title}</strong> has been scheduled for <strong>${slot}</strong>.</p>
      </div>
    `;
  }
}
