import { Injectable } from '@nestjs/common';
import { EnrichmentData, EnrichmentProvider } from './enrichment-provider.interface';
import { slugify } from '../../common/ai/mock-data';

const TECH_STACK_POOL = ['Salesforce', 'HubSpot', 'Slack', 'Notion', 'AWS', 'Segment', 'Zendesk', 'Stripe'];

@Injectable()
export class MockEnrichmentProvider implements EnrichmentProvider {
  async enrich(lead: {
    fullName: string;
    title: string;
    company: string;
    companyDomain?: string | null;
  }): Promise<EnrichmentData> {
    const employeeCount = [8, 25, 80, 150, 400, 1200][Math.floor(Math.random() * 6)];
    const stack = [...TECH_STACK_POOL].sort(() => 0.5 - Math.random()).slice(0, 3);

    return {
      employeeCount,
      estimatedRevenue: employeeCount < 50 ? '$1M–$5M' : employeeCount < 300 ? '$5M–$25M' : '$25M+',
      linkedinUrl: `https://linkedin.com/in/${slugify(lead.fullName)}`,
      phone: undefined,
      techStack: stack,
      companyDescription: `${lead.company} is a fast-growing company in its space, currently scaling its go-to-market team.`,
    };
  }
}
