import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { CalendarProvider, BusyInterval, TokenSet } from './calendar-provider.interface';

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

@Injectable()
export class GoogleCalendarProvider implements CalendarProvider {
  private readonly defaultClientId: string;
  private readonly defaultClientSecret: string;
  private readonly redirectUri: string;
  private readonly anonRedirectUri: string;

  constructor(private config: ConfigService) {
    this.defaultClientId = config.get<string>('GOOGLE_CLIENT_ID', '');
    this.defaultClientSecret = config.get<string>('GOOGLE_CLIENT_SECRET', '');
    this.redirectUri = config.get<string>('GOOGLE_REDIRECT_URI', '');
    this.anonRedirectUri = config.get<string>('GOOGLE_ANON_REDIRECT_URI', '');
  }

  private createClient(credentials?: GoogleCredentials, accessToken?: string, refreshToken?: string) {
    const clientId = credentials?.clientId || this.defaultClientId;
    const clientSecret = credentials?.clientSecret || this.defaultClientSecret;
    const client = new google.auth.OAuth2(clientId, clientSecret, this.redirectUri);
    if (accessToken) client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
    return client;
  }

  getAuthUrl(state: string, credentials?: GoogleCredentials): string {
    const client = this.createClient(credentials);
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar.readonly'],
      state,
    });
  }

  getAnonAuthUrl(state: string, redirectUri: string, credentials?: GoogleCredentials): string {
    const clientId = credentials?.clientId || this.defaultClientId;
    const clientSecret = credentials?.clientSecret || this.defaultClientSecret;
    const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar.freebusy'],
      state,
    });
  }

  async exchangeCode(code: string, credentials?: GoogleCredentials): Promise<TokenSet> {
    const client = this.createClient(credentials);
    const { tokens } = await client.getToken(code);
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
    };
  }

  async exchangeCodeWithRedirect(code: string, redirectUri: string, credentials?: GoogleCredentials): Promise<TokenSet> {
    const clientId = credentials?.clientId || this.defaultClientId;
    const clientSecret = credentials?.clientSecret || this.defaultClientSecret;
    const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await client.getToken(code);
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
    };
  }

  async refreshToken(refreshToken: string, credentials?: GoogleCredentials): Promise<TokenSet> {
    const client = this.createClient(credentials, undefined, refreshToken);
    const { credentials: creds } = await client.refreshAccessToken();
    return {
      accessToken: creds.access_token!,
      refreshToken: creds.refresh_token ?? refreshToken,
      expiresAt: new Date(creds.expiry_date!),
    };
  }

  async getFreeBusy(accessToken: string, calendarId: string, timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
    const client = this.createClient(undefined, accessToken);
    const calendar = google.calendar({ version: 'v3', auth: client });
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      },
    });
    const busy = response.data.calendars?.[calendarId]?.busy ?? [];
    return busy.map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
  }
}
