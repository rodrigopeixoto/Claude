import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../common/ai/ai.service';
import { HunterService } from '../common/hunter/hunter.service';
import { ENRICHMENT_PROVIDER, EnrichmentProvider } from './providers/enrichment-provider.interface';
import { IcpService } from '../icp/icp.service';

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private icp: IcpService,
    private hunter: HunterService,
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
            source: 'mock',
            enrichment: enrichmentData as any,
          },
        });
      }),
    );

    return leads;
  }

  // Real leads sourced from Hunter.io's Domain Search — genuine people with
  // genuine (verified) emails at the company domains you provide. Hunter has
  // no "search by industry/size" endpoint, so unlike generateFromIcp this
  // needs you to name the companies; there is no AI/fabrication involved.
  async sourceRealFromDomains(
    userId: string,
    domains: string[],
    opts: { icpProfileId?: string; department?: string; seniority?: string } = {},
  ) {
    const created: any[] = [];
    for (const domain of [...new Set(domains.map((d) => d.trim().toLowerCase()))].filter(Boolean)) {
      const result = await this.hunter.domainSearch(domain, {
        department: opts.department,
        seniority: opts.seniority,
      });

      for (const contact of result.contacts) {
        const existing = await this.prisma.lead.findFirst({ where: { userId, email: contact.email } });
        if (existing) continue;

        const lead = await this.prisma.lead.create({
          data: {
            userId,
            icpProfileId: opts.icpProfileId,
            fullName: contact.fullName,
            title: contact.title ?? 'Unknown',
            company: result.organization ?? domain,
            companyDomain: domain,
            industry: result.industry,
            location: result.country,
            email: contact.email,
            emailStatus: contact.emailStatus,
            linkedinUrl: contact.linkedinUrl,
            intentScore: contact.confidence ? Math.round(contact.confidence / 3) : 0,
            source: 'hunter',
            enrichment: {
              confidence: contact.confidence,
              seniority: contact.seniority,
              department: contact.department,
              twitter: contact.twitter,
              phoneNumber: contact.phoneNumber,
            } as any,
          },
        });
        created.push(lead);
      }
    }
    return created;
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
