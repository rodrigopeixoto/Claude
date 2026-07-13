export type SignalType = 'JOB_CHANGE' | 'FUNDING_ROUND' | 'LINKEDIN_ENGAGEMENT' | 'CONTENT_POST' | 'HIRING_SURGE';
export type MessageStatus = 'DRAFT' | 'QUEUED' | 'SENT' | 'FAILED';
export type MessageChannel = 'EMAIL' | 'LINKEDIN';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface IcpCriteria {
  industries: string[];
  companySizes: string[];
  titles: string[];
  locations: string[];
  keywords: string[];
}

export interface IcpProfile {
  id: string;
  name: string;
  prompt: string;
  criteria: IcpCriteria;
  createdAt: string;
}

export interface Lead {
  id: string;
  fullName: string;
  title: string;
  company: string;
  companyDomain?: string;
  companySize?: string;
  industry?: string;
  location?: string;
  email?: string;
  linkedinUrl?: string;
  intentScore: number;
  enrichment?: Record<string, unknown>;
  createdAt: string;
}

export interface Signal {
  id: string;
  leadId: string;
  type: SignalType;
  headline: string;
  description: string;
  sourceUrl?: string;
  detectedAt: string;
}

export interface Message {
  id: string;
  leadId: string;
  campaignId?: string;
  channel: MessageChannel;
  subject?: string;
  body: string;
  status: MessageStatus;
  generatedByAi: boolean;
  sentAt?: string;
  createdAt: string;
}

export interface CampaignStep {
  order: number;
  delayDays: number;
  channel?: MessageChannel;
  subjectTemplate?: string;
  bodyTemplate: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  steps: CampaignStep[];
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  createdAt: string;
}
