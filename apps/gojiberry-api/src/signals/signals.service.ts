import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SIGNAL_PROVIDER, SignalProvider } from './providers/signal-provider.interface';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class SignalsService {
  private readonly logger = new Logger(SignalsService.name);

  constructor(
    private prisma: PrismaService,
    private webhooks: WebhooksService,
    @Inject(SIGNAL_PROVIDER) private provider: SignalProvider,
  ) {}

  async listForLead(userId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, userId } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.prisma.signal.findMany({ where: { leadId }, orderBy: { detectedAt: 'desc' } });
  }

  async refreshForLead(userId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, userId } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.refresh(lead);
  }

  private async refresh(lead: {
    id: string;
    userId: string;
    fullName: string;
    title: string;
    company: string;
    industry?: string | null;
  }) {
    const drafts = await this.provider.fetchSignals(lead);
    if (!drafts.length) return [];

    const created = await this.prisma.$transaction(
      drafts.map((d) =>
        this.prisma.signal.create({
          data: {
            leadId: lead.id,
            type: d.type,
            headline: d.headline,
            description: d.description,
            sourceUrl: d.sourceUrl,
          },
        }),
      ),
    );

    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { intentScore: { increment: created.length * 8 } },
    });

    for (const signal of created) {
      await this.webhooks.dispatch(lead.userId, 'lead.signal_detected', {
        leadId: lead.id,
        signal,
      });
    }

    return created;
  }

  // Periodically refreshes signals for a bounded batch of active leads so the
  // demo feels "live" without needing a manual trigger per lead.
  @Cron(CronExpression.EVERY_HOUR)
  async refreshBatch() {
    const leads = await this.prisma.lead.findMany({
      take: 50,
      orderBy: { updatedAt: 'asc' },
    });
    for (const lead of leads) {
      try {
        await this.refresh(lead);
      } catch (err) {
        this.logger.warn(`Signal refresh failed for lead ${lead.id}: ${(err as Error).message}`);
      }
    }
  }
}
