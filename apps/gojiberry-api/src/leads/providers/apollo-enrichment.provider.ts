import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EnrichmentData, EnrichmentProvider } from './enrichment-provider.interface';
import { MockEnrichmentProvider } from './mock-enrichment.provider';

/**
 * Real company enrichment via Apollo.io's Organization Enrichment API
 * (works on Apollo's free tier — unlike People Search/Match, which require a
 * paid plan). Falls back to MockEnrichmentProvider when there's no
 * companyDomain to look up, the API key is missing, or the call fails.
 */
@Injectable()
export class ApolloEnrichmentProvider implements EnrichmentProvider {
  private readonly logger = new Logger(ApolloEnrichmentProvider.name);
  private readonly apiKey: string | undefined;

  constructor(
    private config: ConfigService,
    private mockFallback: MockEnrichmentProvider,
  ) {
    this.apiKey = this.config.get<string>('APOLLO_API_KEY');
  }

  async enrich(lead: {
    fullName: string;
    title: string;
    company: string;
    companyDomain?: string | null;
  }): Promise<EnrichmentData> {
    if (!this.apiKey || !lead.companyDomain) {
      return this.mockFallback.enrich(lead);
    }

    try {
      const res = await axios.get('https://api.apollo.io/api/v1/organizations/enrich', {
        params: { domain: lead.companyDomain },
        headers: { 'x-api-key': this.apiKey },
      });
      const org = res.data.organization;
      if (!org) return this.mockFallback.enrich(lead);

      return {
        employeeCount: org.estimated_num_employees ?? undefined,
        estimatedRevenue: org.annual_revenue
          ? `$${Math.round(org.annual_revenue / 1_000_000)}M`
          : undefined,
        // Company LinkedIn page (real) — Apollo's free tier does not expose
        // per-person data, so we do not fabricate the individual's profile URL.
        linkedinUrl: org.linkedin_url ?? undefined,
        techStack: org.technology_names ?? undefined,
        companyDescription:
          org.short_description ??
          (org.industry ? `${lead.company} operates in ${org.industry}.` : undefined),
      };
    } catch (err) {
      this.logger.warn(
        `Apollo enrichment failed for domain ${lead.companyDomain}, falling back to mock: ${(err as Error).message}`,
      );
      return this.mockFallback.enrich(lead);
    }
  }
}
