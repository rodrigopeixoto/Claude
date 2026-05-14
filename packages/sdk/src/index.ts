import axios, { AxiosInstance } from 'axios';
import type {
  Meeting, Participant, TimeSlot, CreateMeetingInput, UpdateMeetingInput,
  ApiKey, Webhook, CalendarConnection,
} from './types';

export * from './types';

export interface MeetSchedulerClientOptions {
  apiKey?: string;
  token?: string;
  baseUrl?: string;
}

export class MeetSchedulerClient {
  private http: AxiosInstance;

  readonly meetings: MeetingsClient;
  readonly calendars: CalendarsClient;
  readonly apiKeys: ApiKeysClient;
  readonly webhooks: WebhooksClient;

  constructor(options: MeetSchedulerClientOptions) {
    const headers: Record<string, string> = {};
    if (options.apiKey) headers['x-api-key'] = options.apiKey;
    if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

    this.http = axios.create({
      baseURL: options.baseUrl ?? 'http://localhost:3001/api/v1',
      headers,
    });

    this.meetings = new MeetingsClient(this.http);
    this.calendars = new CalendarsClient(this.http);
    this.apiKeys = new ApiKeysClient(this.http);
    this.webhooks = new WebhooksClient(this.http);
  }
}

class MeetingsClient {
  constructor(private http: AxiosInstance) {}

  async create(input: CreateMeetingInput): Promise<Meeting> {
    const res = await this.http.post('/meetings', input);
    return res.data;
  }

  async list(): Promise<Meeting[]> {
    const res = await this.http.get('/meetings');
    return res.data;
  }

  async get(id: string): Promise<Meeting> {
    const res = await this.http.get(`/meetings/${id}`);
    return res.data;
  }

  async update(id: string, input: UpdateMeetingInput): Promise<Meeting> {
    const res = await this.http.patch(`/meetings/${id}`, input);
    return res.data;
  }

  async cancel(id: string): Promise<Meeting> {
    const res = await this.http.delete(`/meetings/${id}`);
    return res.data;
  }

  async confirm(id: string, slotStart: string): Promise<Meeting> {
    const res = await this.http.post(`/meetings/${id}/confirm`, { slotStart });
    return res.data;
  }

  async getSlots(id: string): Promise<TimeSlot[]> {
    const res = await this.http.get(`/meetings/${id}/slots`);
    return res.data;
  }

  async addParticipant(id: string, email: string, name?: string): Promise<Participant> {
    const res = await this.http.post(`/meetings/${id}/participants`, { email, name });
    return res.data;
  }

  async removeParticipant(id: string, participantId: string): Promise<void> {
    await this.http.delete(`/meetings/${id}/participants/${participantId}`);
  }

  async resendInvite(id: string, participantId: string): Promise<{ message: string }> {
    const res = await this.http.post(`/meetings/${id}/participants/${participantId}/resend`);
    return res.data;
  }
}

class CalendarsClient {
  constructor(private http: AxiosInstance) {}

  async list(): Promise<CalendarConnection[]> {
    const res = await this.http.get('/calendars');
    return res.data;
  }

  async remove(id: string): Promise<void> {
    await this.http.delete(`/calendars/${id}`);
  }
}

class ApiKeysClient {
  constructor(private http: AxiosInstance) {}

  async create(name: string, scopes?: string[]): Promise<ApiKey & { key: string }> {
    const res = await this.http.post('/auth/api-keys', { name, scopes });
    return res.data;
  }

  async list(): Promise<ApiKey[]> {
    const res = await this.http.get('/auth/api-keys');
    return res.data;
  }

  async revoke(id: string): Promise<void> {
    await this.http.delete(`/auth/api-keys/${id}`);
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
