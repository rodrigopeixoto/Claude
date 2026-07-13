import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LinkedinService } from '../linkedin/linkedin.service';
import { CreateLeadDto } from './dto/lead.dto';

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private linkedin: LinkedinService,
  ) {}

  private toRecord(dto: CreateLeadDto) {
    return {
      linkedinUrl: dto.linkedinUrl,
      fullName: dto.fullName,
      headline: dto.headline,
      company: dto.company,
      location: dto.location,
      raw: dto.raw ? JSON.stringify(dto.raw) : undefined,
    };
  }

  async create(dto: CreateLeadDto) {
    return this.prisma.lead.upsert({
      where: { linkedinUrl: dto.linkedinUrl },
      create: this.toRecord(dto),
      update: this.toRecord(dto),
    });
  }

  async bulkImport(dtos: CreateLeadDto[]) {
    const leads: Awaited<ReturnType<typeof this.create>>[] = [];
    for (const dto of dtos) {
      leads.push(await this.create(dto));
    }
    return { imported: leads.length, leads };
  }

  async findAll() {
    return this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { outreachItems: true, posts: true } } },
    });
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { posts: { orderBy: { createdAt: 'desc' } }, outreachItems: { orderBy: { createdAt: 'desc' } } },
    });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  private async getLeadOrThrow(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async scrapePosts(id: string, maxPosts?: number) {
    const lead = await this.getLeadOrThrow(id);
    return this.linkedin.startPostsScrape([lead.linkedinUrl], maxPosts);
  }

  /** Best-effort date parsing — actor output shapes for "posted at" vary and are often nested objects, not plain strings. */
  private parsePostedAt(value: unknown): Date | null {
    if (value == null) return null;

    if (typeof value === 'number' || typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === 'object') {
      const candidate = value as Record<string, unknown>;
      for (const key of ['timestamp', 'iso', 'date', 'value']) {
        if (candidate[key] != null) {
          const parsed = this.parsePostedAt(candidate[key]);
          if (parsed) return parsed;
        }
      }
    }

    return null;
  }

  async importPosts(id: string, runId: string) {
    await this.getLeadOrThrow(id);
    const run = await this.linkedin.getRun(runId);
    if (run.status !== 'SUCCEEDED') {
      return { imported: 0, runStatus: run.status };
    }

    const items = (run.items as Record<string, unknown>[]) || [];
    let imported = 0;
    for (const item of items) {
      const text = (item.text as string) ?? (item.content as string) ?? null;
      const postUrl = (item.url as string) ?? (item.postUrl as string) ?? null;
      const postedAt = this.parsePostedAt(item.postedAt ?? item.date ?? item.publishedAt);

      await this.prisma.post.create({
        data: { leadId: id, text, postUrl, postedAt },
      });
      imported++;
    }

    return { imported, runStatus: run.status };
  }
}
