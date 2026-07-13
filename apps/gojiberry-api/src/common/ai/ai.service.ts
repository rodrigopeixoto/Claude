import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  COMPANY_PREFIXES,
  COMPANY_SIZES,
  COMPANY_SUFFIXES,
  FIRST_NAMES,
  INDUSTRIES,
  LAST_NAMES,
  LOCATIONS,
  TITLES_BY_ROLE,
  pick,
  slugify,
} from './mock-data';

export interface IcpCriteria {
  industries: string[];
  companySizes: string[];
  titles: string[];
  locations: string[];
  keywords: string[];
}

export interface LeadDraft {
  fullName: string;
  title: string;
  company: string;
  companyDomain: string;
  companySize: string;
  industry: string;
  location: string;
}

export interface SignalContext {
  headline: string;
  description: string;
}

const MODEL = 'claude-sonnet-4-5';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — AI features will use deterministic mock generation.',
      );
    }
  }

  get enabled() {
    return this.client !== null;
  }

  async parsePromptToIcp(prompt: string): Promise<{ name: string; criteria: IcpCriteria }> {
    if (this.client) {
      try {
        const msg = await this.client.messages.create({
          model: MODEL,
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `Extract a structured Ideal Customer Profile (ICP) from this description of who a sales team wants to target. Return ONLY valid JSON, no prose, matching this shape:
{"name": "short label for this ICP", "criteria": {"industries": string[], "companySizes": string[] (choose from "1-10","11-50","51-200","201-500","501-1000","1000+"), "titles": string[], "locations": string[], "keywords": string[]}}

Description: """${prompt}"""`,
            },
          ],
        });
        const text = msg.content.find((b) => b.type === 'text')?.text ?? '{}';
        const parsed = JSON.parse(this.extractJson(text));
        return { name: parsed.name ?? 'ICP sem título', criteria: parsed.criteria };
      } catch (err) {
        this.logger.warn(`AI parsePromptToIcp failed, falling back to mock: ${(err as Error).message}`);
      }
    }
    return this.mockParsePromptToIcp(prompt);
  }

  async generateLeads(criteria: IcpCriteria, count: number): Promise<LeadDraft[]> {
    if (this.client) {
      try {
        const msg = await this.client.messages.create({
          model: MODEL,
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: `Generate ${count} plausible (fictional, not real people) B2B lead profiles matching this ICP criteria: ${JSON.stringify(
                criteria,
              )}. Return ONLY a valid JSON array, no prose, each item shaped as:
{"fullName": string, "title": string, "company": string, "companyDomain": string (lowercase, e.g. "acme.com"), "companySize": string, "industry": string, "location": string}`,
            },
          ],
        });
        const text = msg.content.find((b) => b.type === 'text')?.text ?? '[]';
        const parsed = JSON.parse(this.extractJson(text));
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {
        this.logger.warn(`AI generateLeads failed, falling back to mock: ${(err as Error).message}`);
      }
    }
    return this.mockGenerateLeads(criteria, count);
  }

  async generateOutreachMessage(
    lead: { fullName: string; title: string; company: string; industry?: string | null },
    signals: SignalContext[],
    tone = 'consultative and concise',
  ): Promise<{ subject: string; body: string }> {
    if (this.client) {
      try {
        const signalText = signals.length
          ? signals.map((s) => `- ${s.headline}: ${s.description}`).join('\n')
          : 'No recent buying signals detected yet.';
        const msg = await this.client.messages.create({
          model: MODEL,
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `Write a short, personalized cold outreach email to this B2B lead. Tone: ${tone}. Keep it under 120 words, no generic fluff, reference the buying signal if there is one. Return ONLY valid JSON: {"subject": string, "body": string}.

Lead: ${lead.fullName}, ${lead.title} at ${lead.company}${lead.industry ? ` (${lead.industry})` : ''}.
Recent signals:
${signalText}`,
            },
          ],
        });
        const text = msg.content.find((b) => b.type === 'text')?.text ?? '{}';
        const parsed = JSON.parse(this.extractJson(text));
        if (parsed.subject && parsed.body) return parsed;
      } catch (err) {
        this.logger.warn(
          `AI generateOutreachMessage failed, falling back to template: ${(err as Error).message}`,
        );
      }
    }
    return this.mockGenerateOutreachMessage(lead, signals);
  }

  private extractJson(text: string): string {
    const start = Math.min(
      ...['{', '['].map((c) => (text.indexOf(c) === -1 ? Infinity : text.indexOf(c))),
    );
    const lastCurly = text.lastIndexOf('}');
    const lastSquare = text.lastIndexOf(']');
    const end = Math.max(lastCurly, lastSquare);
    if (!isFinite(start) || end === -1) return text;
    return text.slice(start, end + 1);
  }

  private mockParsePromptToIcp(prompt: string): { name: string; criteria: IcpCriteria } {
    const lower = prompt.toLowerCase();
    const industries = INDUSTRIES.filter((i) => lower.includes(i.toLowerCase()));
    const roleKey = Object.keys(TITLES_BY_ROLE).find((role) => lower.includes(role)) as
      | keyof typeof TITLES_BY_ROLE
      | undefined;

    return {
      name: prompt.length > 40 ? `${prompt.slice(0, 37)}...` : prompt,
      criteria: {
        industries: industries.length ? industries : [pick(INDUSTRIES)],
        companySizes: [pick(COMPANY_SIZES), pick(COMPANY_SIZES)],
        titles: roleKey ? TITLES_BY_ROLE[roleKey] : TITLES_BY_ROLE.sales,
        locations: [pick(LOCATIONS)],
        keywords: prompt
          .split(/\s+/)
          .filter((w) => w.length > 4)
          .slice(0, 6),
      },
    };
  }

  private mockGenerateLeads(criteria: IcpCriteria, count: number): LeadDraft[] {
    return Array.from({ length: count }).map(() => {
      const company = `${pick(COMPANY_PREFIXES)}${pick(COMPANY_SUFFIXES)}`;
      return {
        fullName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        title: pick(criteria.titles?.length ? criteria.titles : TITLES_BY_ROLE.sales),
        company,
        companyDomain: `${slugify(company)}.com`,
        companySize: pick(criteria.companySizes?.length ? criteria.companySizes : COMPANY_SIZES),
        industry: pick(criteria.industries?.length ? criteria.industries : INDUSTRIES),
        location: pick(criteria.locations?.length ? criteria.locations : LOCATIONS),
      };
    });
  }

  private mockGenerateOutreachMessage(
    lead: { fullName: string; title: string; company: string },
    signals: SignalContext[],
  ): { subject: string; body: string } {
    const firstName = lead.fullName.split(' ')[0];
    const hook = signals[0]
      ? `Saw that ${signals[0].description.toLowerCase()} — congrats on that.`
      : `Came across ${lead.company} and thought it was a great fit for what we're building.`;

    return {
      subject: `Quick question for ${firstName}`,
      body: `Hi ${firstName},\n\n${hook}\n\nWe help teams like yours turn buying-intent signals into pipeline without the manual prospecting grind. Worth a quick 15-min chat this week?\n\nBest,\nYour name`,
    };
  }
}
