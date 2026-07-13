import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../common/ai/ai.service';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly resend: Resend | null;
  private readonly emailFrom: string;

  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private webhooks: WebhooksService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.emailFrom = this.config.get<string>('EMAIL_FROM', 'outreach@gojiberry-clone.dev');
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not set — sending will run in dry-run mode.');
    }
  }

  async generateForLead(userId: string, leadId: string, campaignId?: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, userId },
      include: { signals: { orderBy: { detectedAt: 'desc' }, take: 3 } },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const { subject, body } = await this.ai.generateOutreachMessage(
      lead,
      lead.signals.map((s) => ({ headline: s.headline, description: s.description })),
    );

    const message = await this.prisma.message.create({
      data: { userId, leadId, campaignId, subject, body, status: 'DRAFT', generatedByAi: true },
    });

    await this.webhooks.dispatch(userId, 'message.generated', { messageId: message.id, leadId });
    return message;
  }

  async update(userId: string, id: string, data: { subject?: string; body?: string }) {
    const message = await this.prisma.message.findFirst({ where: { id, userId } });
    if (!message) throw new NotFoundException('Message not found');
    return this.prisma.message.update({ where: { id }, data });
  }

  list(userId: string, leadId?: string) {
    return this.prisma.message.findMany({
      where: { userId, ...(leadId ? { leadId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async send(userId: string, id: string) {
    const message = await this.prisma.message.findFirst({
      where: { id, userId },
      include: { lead: true },
    });
    if (!message) throw new NotFoundException('Message not found');

    if (this.resend && message.lead.email) {
      try {
        await this.resend.emails.send({
          from: this.emailFrom,
          to: message.lead.email,
          subject: message.subject ?? '',
          text: message.body,
        });
      } catch (err) {
        this.logger.warn(`Send failed for message ${id}: ${(err as Error).message}`);
        const failed = await this.prisma.message.update({
          where: { id },
          data: { status: 'FAILED' },
        });
        return failed;
      }
    } else {
      this.logger.log(`[dry-run] Would send message ${id} to ${message.lead.email ?? '(no email on file)'}`);
    }

    const sent = await this.prisma.message.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    await this.webhooks.dispatch(userId, 'message.sent', { messageId: id, leadId: message.leadId });
    return sent;
  }
}
