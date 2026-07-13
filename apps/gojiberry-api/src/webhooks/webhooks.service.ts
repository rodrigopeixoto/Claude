import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHmac, randomBytes } from 'crypto';
import axios from 'axios';

export type WebhookEvent =
  | 'lead.created'
  | 'lead.signal_detected'
  | 'message.generated'
  | 'message.sent';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, url: string, events: string[]) {
    const secret = randomBytes(32).toString('hex');
    return this.prisma.webhook.create({
      data: { userId, url, events, secret },
      select: { id: true, url: true, events: true, secret: true, createdAt: true },
    });
  }

  async list(userId: string) {
    return this.prisma.webhook.findMany({
      where: { userId },
      select: { id: true, url: true, events: true, createdAt: true },
    });
  }

  async remove(userId: string, id: string) {
    const wh = await this.prisma.webhook.findFirst({ where: { id, userId } });
    if (!wh) throw new NotFoundException('Webhook not found');
    await this.prisma.webhook.delete({ where: { id } });
  }

  async dispatch(userId: string, event: WebhookEvent, payload: object) {
    const hooks = await this.prisma.webhook.findMany({
      where: { userId, events: { has: event } },
    });

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

    for (const hook of hooks) {
      const sig = createHmac('sha256', hook.secret).update(body).digest('hex');
      try {
        await axios.post(hook.url, body, {
          headers: {
            'Content-Type': 'application/json',
            'X-Gojiberry-Signature': `sha256=${sig}`,
          },
          timeout: 5000,
        });
      } catch (err) {
        this.logger.warn(`Webhook delivery failed for ${hook.url}: ${(err as Error).message}`);
      }
    }
  }
}
