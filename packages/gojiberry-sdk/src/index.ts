import axios, { AxiosInstance } from 'axios';
import type {
  IcpProfile, Lead, Signal, Message, Campaign, CampaignStep, ApiKey, Webhook,
} from './types';

export * from './types';

export interface GojiberryCloneClientOptions {
  apiKey?: string;
  token?: string;
  baseUrl?: string;
}

export class GojiberryCloneClient {
  private http: AxiosInstance;

  readonly icp: IcpClient;
  readonly leads: LeadsClient;
  readonly signals: SignalsClient;
  readonly messages: MessagesClient;
  readonly campaigns: CampaignsClient;
  readonly apiKeys: ApiKeysClient;
  readonly webhooks: WebhooksClient;

  constructor(options: GojiberryCloneClientOptions) {
    const headers: Record<string, string> = {};
    if (options.apiKey) headers['x-api-key'] = options.apiKey;
    if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

    this.http = axios.create({
      baseURL: options.baseUrl ?? 'http://localhost:3011/api/v1',
      headers,
    });

    this.icp = new IcpClient(this.http);
    this.leads = new LeadsClient(this.http);
    this.signals = new SignalsClient(this.http);
    this.messages = new MessagesClient(this.http);
    this.campaigns = new CampaignsClient(this.http);
    this.apiKeys = new ApiKeysClient(this.http);
    this.webhooks = new WebhooksClient(this.http);
  }
}

class IcpClient {
  constructor(private http: AxiosInstance) {}

  async create(prompt: string): Promise<IcpProfile> {
    const res = await this.http.post('/icp', { prompt });
    return res.data;
  }

  async list(): Promise<IcpProfile[]> {
    const res = await this.http.get('/icp');
    return res.data;
  }

  async get(id: string): Promise<IcpProfile> {
    const res = await this.http.get(`/icp/${id}`);
    return res.data;
  }
}

class LeadsClient {
  constructor(private http: AxiosInstance) {}

  async generate(icpProfileId: string, count?: number): Promise<Lead[]> {
    const res = await this.http.post('/leads/generate', { icpProfileId, count });
    return res.data;
  }

  async list(icpProfileId?: string): Promise<Lead[]> {
    const res = await this.http.get('/leads', { params: icpProfileId ? { icpProfileId } : {} });
    return res.data;
  }

  async get(id: string): Promise<Lead> {
    const res = await this.http.get(`/leads/${id}`);
    return res.data;
  }
}

class SignalsClient {
  constructor(private http: AxiosInstance) {}

  async list(leadId: string): Promise<Signal[]> {
    const res = await this.http.get(`/leads/${leadId}/signals`);
    return res.data;
  }

  async refresh(leadId: string): Promise<Signal[]> {
    const res = await this.http.post(`/leads/${leadId}/signals/refresh`);
    return res.data;
  }
}

class MessagesClient {
  constructor(private http: AxiosInstance) {}

  async generate(leadId: string, campaignId?: string): Promise<Message> {
    const res = await this.http.post('/messages/generate', { leadId, campaignId });
    return res.data;
  }

  async list(leadId?: string): Promise<Message[]> {
    const res = await this.http.get('/messages', { params: leadId ? { leadId } : {} });
    return res.data;
  }

  async update(id: string, data: { subject?: string; body?: string }): Promise<Message> {
    const res = await this.http.patch(`/messages/${id}`, data);
    return res.data;
  }

  async send(id: string): Promise<Message> {
    const res = await this.http.post(`/messages/${id}/send`);
    return res.data;
  }
}

class CampaignsClient {
  constructor(private http: AxiosInstance) {}

  async create(name: string, steps: CampaignStep[], icpProfileId?: string): Promise<Campaign> {
    const res = await this.http.post('/campaigns', { name, steps, icpProfileId });
    return res.data;
  }

  async list(): Promise<Campaign[]> {
    const res = await this.http.get('/campaigns');
    return res.data;
  }

  async get(id: string): Promise<Campaign> {
    const res = await this.http.get(`/campaigns/${id}`);
    return res.data;
  }

  async setStatus(id: string, status: Campaign['status']): Promise<Campaign> {
    const res = await this.http.patch(`/campaigns/${id}/status`, { status });
    return res.data;
  }

  async enroll(id: string, leadIds: string[]): Promise<void> {
    await this.http.post(`/campaigns/${id}/enroll`, { leadIds });
  }
}

class ApiKeysClient {
  constructor(private http: AxiosInstance) {}

  async create(name: string, scopes?: string[]): Promise<ApiKey & { key: string }> {
    const res = await this.http.post('/api-keys', { name, scopes });
    return res.data;
  }

  async list(): Promise<ApiKey[]> {
    const res = await this.http.get('/api-keys');
    return res.data;
  }

  async revoke(id: string): Promise<void> {
    await this.http.delete(`/api-keys/${id}`);
  }
}

class WebhooksClient {
  constructor(private http: AxiosInstance) {}

  async create(url: string, events: string[]): Promise<Webhook> {
    const res = await this.http.post('/webhooks', { url, events });
    return res.data;
  }

  async list(): Promise<Webhook[]> {
    const res = await this.http.get('/webhooks');
    return res.data;
  }

  async remove(id: string): Promise<void> {
    await this.http.delete(`/webhooks/${id}`);
  }
}
