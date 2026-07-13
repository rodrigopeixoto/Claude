import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface HunterContact {
  fullName: string;
  title: string | null;
  email: string;
  emailStatus: string | null;
  confidence: number | null;
  seniority: string | null;
  department: string | null;
  linkedinUrl: string | null;
  twitter: string | null;
  phoneNumber: string | null;
}

export interface HunterDomainResult {
  domain: string;
  organization: string | null;
  industry: string | null;
  country: string | null;
  contacts: HunterContact[];
}

/**
 * Thin client for the real Hunter.io API (https://hunter.io/api-documentation).
 * This is a genuine third-party data source — Hunter does its own compliant
 * public-web data collection; we never scrape LinkedIn (or anything else)
 * ourselves. Requires HUNTER_API_KEY.
 */
@Injectable()
export class HunterService {
  private readonly logger = new Logger(HunterService.name);
  private readonly apiKey: string | undefined;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('HUNTER_API_KEY');
    if (!this.apiKey) {
      this.logger.warn('HUNTER_API_KEY not set — real lead sourcing is disabled.');
    }
  }

  get enabled() {
    return !!this.apiKey;
  }

  async domainSearch(
    domain: string,
    opts: { department?: string; seniority?: string; limit?: number } = {},
  ): Promise<HunterDomainResult> {
    if (!this.apiKey) {
      throw new BadGatewayException(
        'HUNTER_API_KEY não configurada — sourcing de leads reais está desabilitado.',
      );
    }

    try {
      const res = await axios.get('https://api.hunter.io/v2/domain-search', {
        params: {
          domain,
          api_key: this.apiKey,
          department: opts.department,
          seniority: opts.seniority,
          limit: opts.limit ?? 10,
        },
      });

      const data = res.data.data;
      return {
        domain: data.domain,
        organization: data.organization ?? null,
        industry: data.industry ?? null,
        country: data.country ?? null,
        contacts: (data.emails ?? [])
          .filter((e: any) => e.value)
          .map((e: any) => ({
            fullName: [e.first_name, e.last_name].filter(Boolean).join(' ') || e.value,
            title: e.position ?? null,
            email: e.value,
            emailStatus: e.verification?.status ?? null,
            confidence: e.confidence ?? null,
            seniority: e.seniority ?? null,
            department: e.department ?? null,
            linkedinUrl: e.linkedin ?? null,
            twitter: e.twitter ?? null,
            phoneNumber: e.phone_number ?? null,
          })),
      };
    } catch (err: any) {
      const apiError = err.response?.data?.errors?.[0];
      const message = apiError
        ? `Hunter.io: ${apiError.details ?? apiError.id} (código ${apiError.code})`
        : `Hunter.io request failed: ${err.message}`;
      this.logger.warn(message);
      throw new BadGatewayException(message);
    }
  }
}
