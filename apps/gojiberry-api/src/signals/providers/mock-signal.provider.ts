import { Injectable } from '@nestjs/common';
import { SignalDraft, SignalProvider } from './signal-provider.interface';

const JOB_CHANGE_TEMPLATES = (name: string, title: string, company: string) => [
  `${name} was recently promoted to ${title} at ${company}`,
  `${name} joined ${company} as ${title} in the last few weeks`,
];

const FUNDING_TEMPLATES = (company: string) => [
  `${company} closed a new funding round`,
  `${company} was mentioned in a funding announcement`,
];

const ENGAGEMENT_TEMPLATES = (name: string) => [
  `${name} liked a post about scaling outbound sales`,
  `${name} commented on a post about GTM tooling`,
  `${name} shared an article about pipeline generation`,
];

const CONTENT_TEMPLATES = (name: string) => [
  `${name} published a post about their team's growth`,
  `${name} wrote about hiring plans for next quarter`,
];

const HIRING_TEMPLATES = (company: string) => [
  `${company} opened multiple sales roles this month`,
  `${company} is hiring for a Revenue Operations lead`,
];

@Injectable()
export class MockSignalProvider implements SignalProvider {
  async fetchSignals(lead: {
    id: string;
    fullName: string;
    title: string;
    company: string;
  }): Promise<SignalDraft[]> {
    const signals: SignalDraft[] = [];
    const roll = Math.random();

    if (roll < 0.35) {
      signals.push({
        type: 'LINKEDIN_ENGAGEMENT',
        headline: 'LinkedIn engagement detected',
        description: pick(ENGAGEMENT_TEMPLATES(lead.fullName)),
      });
    }
    if (roll < 0.15) {
      signals.push({
        type: 'JOB_CHANGE',
        headline: 'Job change detected',
        description: pick(JOB_CHANGE_TEMPLATES(lead.fullName, lead.title, lead.company)),
      });
    }
    if (roll > 0.8 && roll < 0.92) {
      signals.push({
        type: 'FUNDING_ROUND',
        headline: 'Funding event detected',
        description: pick(FUNDING_TEMPLATES(lead.company)),
      });
    }
    if (roll > 0.55 && roll < 0.68) {
      signals.push({
        type: 'CONTENT_POST',
        headline: 'New content published',
        description: pick(CONTENT_TEMPLATES(lead.fullName)),
      });
    }
    if (roll > 0.92) {
      signals.push({
        type: 'HIRING_SURGE',
        headline: 'Hiring surge detected',
        description: pick(HIRING_TEMPLATES(lead.company)),
      });
    }

    return signals;
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
