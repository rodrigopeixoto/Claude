import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { CalendarProvider, BusyInterval, TokenSet } from './calendar-provider.interface';

@Injectable()
export class GoogleCalendarProvider implements CalendarProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private config: ConfigService) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID', '');
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET', '');
    this.redirectUri = config.get<string>('GOOGLE_REDIRECT_URI', '');
  }

  private createClient(accessToken?: string, refreshToken?: string) {
    const client = new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
    if (accessToken) client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
    return client;
  }

  getAuthUrl(state: string): string {
    const client = this.createClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar.readonly'],
      state,
    });
  }

  getAnonAuthUrl(state: string, redirectUri: string): string {
    const client = new google.auth.OAuth2(this.clientId, this.clientSecret, redirectUri);
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar.freebusy'],
      state,
    });
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    const client = this.createClient();
    const { tokens } = await client.getToken(code);
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
    };
  }

  async exchangeCodeWithRedirect(code: string, redirectUri: string): Promise<TokenSet> {
    const client = new google.auth.OAuth2(this.clientId, this.clientSecret, redirectUri);
    const { tokens } = await client.getToken(code);
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const client = this.createClient(undefined, refreshToken);
    const { credentials } = await client.refreshAccessToken();
    return {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiresAt: new Date(credentials.expiry_date!),
    };
  }

  async getFreeBusy(
    accessToken: string,
    calendarId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<BusyInterval[]> {
    const client = this.createClient(accessToken);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const busy = response.data.calendars?.[calendarId]?.busy ?? [];
    return busy.map((b) => ({
      start: new Date(b.start!),
      end: new Date(b.end!),
    }));
  }
}
