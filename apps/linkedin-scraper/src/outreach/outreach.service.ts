import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OutreachLimitsService } from './outreach-limits.service';
import { GenerateDraftDto } from './dto/outreach.dto';

const CONNECTION_REQUEST_CHAR_LIMIT = 300; // LinkedIn's hard cap on connection-request notes

@Injectable()
export class OutreachService {
  constructor(
    private prisma: PrismaService,
    private limits: OutreachLimitsService,
  ) {}

  private async getItemOrThrow(id: string) {
    const item = await this.prisma.outreachItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Outreach item ${id} not found`);
    return item;
  }

  async findAll(status?: string) {
    return this.prisma.outreachItem.findMany({
      where: status ? { status } : undefined,
      include: { lead: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDraft(leadId: string, type: string, draftText: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    return this.prisma.outreachItem.create({
      data: { leadId, type, draftText, status: 'draft' },
    });
  }

  async generateDraft(dto: GenerateDraftDto) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
      include: { posts: { orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }], take: 1 } },
    });
    if (!lead) throw new NotFoundException(`Lead ${dto.leadId} not found`);

    let post = lead.posts[0];
    if (dto.postId) {
      const found = await this.prisma.post.findUnique({ where: { id: dto.postId } });
      if (!found || found.leadId !== dto.leadId) {
        throw new NotFoundException(`Post ${dto.postId} not found for this lead`);
      }
      post = found;
    }

    // Connection-request notes are capped at 300 chars by LinkedIn, so keep the
    // {{post}} excerpt short enough that the template's own wording still fits.
    const postExcerptLength = dto.type === 'connection_request' ? 80 : 200;

    const firstName = lead.fullName?.split(' ')[0] || '';
    let draftText = dto.template
      .replaceAll('{{firstName}}', firstName)
      .replaceAll('{{fullName}}', lead.fullName || '')
      .replaceAll('{{company}}', lead.company || '')
      .replaceAll('{{headline}}', lead.headline || '')
      .replaceAll('{{post}}', post?.text?.slice(0, postExcerptLength) || '');

    if (dto.type === 'connection_request' && draftText.length > CONNECTION_REQUEST_CHAR_LIMIT) {
      draftText = this.truncateToLimit(draftText, CONNECTION_REQUEST_CHAR_LIMIT);
    }

    return this.createDraft(dto.leadId, dto.type, draftText);
  }

  /** Truncates at the last word boundary within range, so we don't cut mid-word unless necessary. */
  private truncateToLimit(text: string, limit: number): string {
    const cut = text.slice(0, limit - 1);
    const lastSpace = cut.lastIndexOf(' ');
    const trimmed = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut;
    return `${trimmed.trimEnd()}…`;
  }

  async updateDraft(id: string, draftText: string) {
    const item = await this.getItemOrThrow(id);
    if (item.status !== 'draft' && item.status !== 'queued') {
      throw new BadRequestException(`Cannot edit an item with status "${item.status}"`);
    }
    return this.prisma.outreachItem.update({ where: { id }, data: { draftText } });
  }

  async queue(id: string) {
    const item = await this.getItemOrThrow(id);
    if (item.status !== 'draft') {
      throw new BadRequestException(`Only draft items can be queued (current status: "${item.status}")`);
    }
    return this.prisma.outreachItem.update({
      where: { id },
      data: { status: 'queued', queuedAt: new Date() },
    });
  }

  async getQueue() {
    const items = await this.prisma.outreachItem.findMany({
      where: { status: 'queued' },
      orderBy: { queuedAt: 'asc' },
      include: { lead: true },
    });
    return { items, stats: await this.getStats() };
  }

  async getStats() {
    const { start, end } = this.limits.todayRange();
    const sentToday = await this.prisma.outreachItem.findMany({
      where: { status: { in: ['sent', 'accepted', 'replied'] }, sentAt: { gte: start, lte: end } },
      select: { type: true },
    });

    const connectionsSent = sentToday.filter((i) => i.type === 'connection_request').length;
    const messagesSent = sentToday.filter((i) => i.type === 'message').length;
    const totalSent = sentToday.length;

    const dueForWithdrawal = await this.prisma.outreachItem.count({
      where: { status: 'sent', type: 'connection_request', withdrawDueAt: { lte: new Date() } },
    });

    return {
      timezone: this.limits.timezone,
      isWithinBusinessHours: this.limits.isWithinBusinessHours(),
      today: {
        connectionsSent,
        connectionLimit: this.limits.dailyConnectionLimit,
        messagesSent,
        messageLimit: this.limits.dailyMessageLimit,
        totalSent,
        totalLimit: this.limits.dailyActionLimit,
      },
      dueForWithdrawal,
    };
  }

  async markSent(id: string) {
    const item = await this.getItemOrThrow(id);
    if (item.status !== 'queued') {
      throw new BadRequestException(`Only queued items can be marked as sent (current status: "${item.status}")`);
    }

    if (!this.limits.isWithinBusinessHours()) {
      throw new ForbiddenException(
        `Fora do horário comercial configurado (${this.limits.businessHourStart}h-${this.limits.businessHourEnd}h, ${this.limits.timezone}). Aguarde o próximo horário permitido.`,
      );
    }

    const { today } = await this.getStats();
    if (today.totalSent >= today.totalLimit) {
      throw new ForbiddenException(`Limite diário de ${today.totalLimit} ações já atingido.`);
    }
    if (item.type === 'connection_request' && today.connectionsSent >= today.connectionLimit) {
      throw new ForbiddenException(`Limite diário de ${today.connectionLimit} convites de conexão já atingido.`);
    }
    if (item.type === 'message' && today.messagesSent >= today.messageLimit) {
      throw new ForbiddenException(`Limite diário de ${today.messageLimit} conversas já atingido.`);
    }

    const now = new Date();
    const withdrawDueAt =
      item.type === 'connection_request'
        ? new Date(now.getTime() + this.limits.withdrawAfterDays * 24 * 60 * 60 * 1000)
        : null;

    return this.prisma.outreachItem.update({
      where: { id },
      data: { status: 'sent', sentAt: now, withdrawDueAt },
    });
  }

  async markStatus(id: string, status: string) {
    const item = await this.getItemOrThrow(id);

    const allowedFrom = status === 'skipped' ? ['draft', 'queued'] : ['sent'];
    if (!allowedFrom.includes(item.status)) {
      throw new BadRequestException(
        `Cannot move an item from "${item.status}" to "${status}" (allowed from: ${allowedFrom.join(', ')})`,
      );
    }

    return this.prisma.outreachItem.update({ where: { id }, data: { status } });
  }

  async getDueForWithdrawal() {
    return this.prisma.outreachItem.findMany({
      where: { status: 'sent', type: 'connection_request', withdrawDueAt: { lte: new Date() } },
      include: { lead: true },
      orderBy: { withdrawDueAt: 'asc' },
    });
  }
}
