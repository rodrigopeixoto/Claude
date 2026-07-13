import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../common/ai/ai.service';
import { ENRICHMENT_PROVIDER, EnrichmentProvider } from './providers/enrichment-provider.interface';
import { IcpService } from '../icp/icp.service';

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private icp: IcpService,
    @Inject(ENRICHMENT_PROVIDER) private enrichment: EnrichmentProvider,
  ) {}

  async generateFromIcp(userId: string, icpId: string, count = 10) {
    const icpProfile = await this.icp.findOne(userId, icpId);
    const drafts = await this.ai.generateLeads(icpProfile.criteria as any, Math.min(count, 25));

    const leads = await Promise.all(
      drafts.map(async (draft) => {
        const enrichmentData = await this.enrichment.enrich(draft);
        return this.prisma.lead.create({
          data: {
            userId,
            icpProfileId: icpProfile.id,
            fullName: draft.fullName,
            title: draft.title,
            company: draft.company,
            companyDomain: draft.companyDomain,
            companySize: draft.companySize,
            industry: draft.industry,
            location: draft.location,
            linkedinUrl: enrichmentData.linkedinUrl,
            intentScore: Math.floor(Math.random() * 40),
            enrichment: enrichmentData as any,
          },
        });
      }),
    );

    return leads;
  }

  list(userId: string, icpProfileId?: string) {
    return this.prisma.lead.findMany({
      where: { userId, ...(icpProfileId ? { icpProfileId } : {}) },
      orderBy: { intentScore: 'desc' },
      include: { _count: { select: { signals: true } } },
    });
  }

  async findOne(userId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, userId },
      include: { signals: { orderBy: { detectedAt: 'desc' } }, messages: { orderBy: { createdAt: 'desc' } } },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async bumpIntentScore(leadId: string, delta: number) {
    return this.prisma.lead.update({
      where: { id: leadId },
      data: { intentScore: { increment: delta } },
    });
  }
}
