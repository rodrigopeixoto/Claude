import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { CalendarProvider, BusyInterval, TokenSet } from './calendar-provider.interface';

@Injectable()
export class MicrosoftCalendarProvider implements CalendarProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tenantId: string;
  private readonly redirectUri: string;
  private readonly msal: ConfidentialClientApplication;

  constructor(private config: ConfigService) {
    this.clientId = config.get<string>('MICROSOFT_CLIENT_ID', '');
    this.clientSecret = config.get<string>('MICROSOFT_CLIENT_SECRET', '');
    this.tenantId = config.get<string>('MICROSOFT_TENANT_ID', 'common');
    this.redirectUri = config.get<string>('MICROSOFT_REDIRECT_URI', '');

    this.msal = new ConfidentialClientApplication({
      auth: {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        authority: `https://login.microsoftonline.com/${this.tenantId}`,
      },
    });
  }

  getAuthUrl(state: string): string {
    return this.buildAuthUrl(state, this.redirectUri, ['Calendars.Read']);
  }

  getAnonAuthUrl(state: string, redirectUri: string): string {
    return this.buildAuthUrl(state, redirectUri, ['Calendars.Read.Shared']);
  }

  private buildAuthUrl(state: string, redirectUri: string, scopes: string[]): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: [...scopes, 'offline_access', 'openid'].join(' '),
      state,
      prompt: 'consent',
    });
    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<TokenSet> {
    return this.exchange(code, this.redirectUri);
  }

  async exchangeCodeWithRedirect(code: string, redirectUri: string): Promise<TokenSet> {
    return this.exchange(code, redirectUri);
  }

  private async exchange(code: string, redirectUri: string): Promise<TokenSet> {
    const result = await this.msal.acquireTokenByCode({
      code,
      redirectUri,
      scopes: ['Calendars.Read', 'offline_access'],
    });
    return {
      accessToken: result!.accessToken,
      refreshToken: (result as any).refreshToken ?? '',
      expiresAt: result!.expiresOn!,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const result = await this.msal.acquireTokenByRefreshToken({
      refreshToken,
      scopes: ['Calendars.Read', 'offline_access'],
    });
    return {
      accessToken: result!.accessToken,
      refreshToken: (result as any).refreshToken ?? refreshToken,
      expiresAt: result!.expiresOn!,
    };
  }

  async getFreeBusy(
    accessToken: string,
    _calendarId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<BusyInterval[]> {
    const client = Client.init({
      authProvider: (done) => done(null, accessToken),
    });

    const response = await client.api('/me/calendarView').query({
      startDateTime: timeMin.toISOString(),
      endDateTime: timeMax.toISOString(),
      $select: 'start,end,showAs',
      $top: 100,
    }).get();

    const events: any[] = response.value ?? [];
    return events
      .filter((e) => e.showAs !== 'free' && e.showAs !== 'workingElsewhere')
      .map((e) => ({
        start: new Date(e.start.dateTime + 'Z'),
        end: new Date(e.end.dateTime + 'Z'),
      }));
  }
}
