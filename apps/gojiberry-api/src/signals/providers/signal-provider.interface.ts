export type SignalKind = 'JOB_CHANGE' | 'FUNDING_ROUND' | 'LINKEDIN_ENGAGEMENT' | 'CONTENT_POST' | 'HIRING_SURGE';

export interface SignalDraft {
  type: SignalKind;
  headline: string;
  description: string;
  sourceUrl?: string;
}

/**
 * Pluggable buying-intent signal source.
 *
 * IMPORTANT: this app does NOT scrape LinkedIn. Automated scraping of
 * LinkedIn profiles/activity violates LinkedIn's Terms of Service and is
 * not implemented here. MockSignalProvider generates realistic-looking
 * demo signals so the product experience works end-to-end locally.
 *
 * To go live, implement this interface against a compliant, licensed data
 * source (e.g. a B2B intent-data vendor with an official API) and rebind
 * the SIGNAL_PROVIDER token in signals.module.ts — no other code changes
 * needed.
 */
export interface SignalProvider {
  fetchSignals(lead: {
    id: string;
    fullName: string;
    title: string;
    company: string;
    industry?: string | null;
  }): Promise<SignalDraft[]>;
}

export const SIGNAL_PROVIDER = 'SIGNAL_PROVIDER';
