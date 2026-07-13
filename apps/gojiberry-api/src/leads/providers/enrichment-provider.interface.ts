export interface EnrichmentData {
  employeeCount?: number;
  estimatedRevenue?: string;
  linkedinUrl?: string;
  phone?: string;
  techStack?: string[];
  companyDescription?: string;
}

/**
 * Pluggable contact/company enrichment. The default MockEnrichmentProvider
 * fabricates plausible data for local development. Swap in a real provider
 * (Apollo, Clearbit, Clay, etc.) by implementing this interface and rebinding
 * the ENRICHMENT_PROVIDER token in leads.module.ts.
 */
export interface EnrichmentProvider {
  enrich(lead: {
    fullName: string;
    title: string;
    company: string;
    companyDomain?: string | null;
  }): Promise<EnrichmentData>;
}

export const ENRICHMENT_PROVIDER = 'ENRICHMENT_PROVIDER';
