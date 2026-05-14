import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHmac, randomBytes } from 'crypto';
import axios from 'axios';

export type WebhookEvent =
  | 'meeting.slot_confirmed'
  | 'participant.connected'
  | 'participant.declined';

@Injectable()
export class WebhooksService {
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
            'X-MeetScheduler-Signature': `sha256=${sig}`,
          },
          timeout: 5000,
        });
      } catch {
        // Fire and forget — failed deliveries are not retried in this version
      }
    }
  }
}
