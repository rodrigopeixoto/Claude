import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { CalendarProvider, BusyInterval, TokenSet } from './calendar-provider.interface';

export interface MicrosoftCredentials {
  clientId: string;
  clientSecret: string;
}

@Injectable()
export class MicrosoftCalendarProvider implements CalendarProvider {
  private readonly defaultClientId: string;
  private readonly defaultClientSecret: string;
  private readonly tenantId: string;
  private readonly redirectUri: string;

  constructor(private config: ConfigService) {
    this.defaultClientId = config.get<string>('MICROSOFT_CLIENT_ID', '');
    this.defaultClientSecret = config.get<string>('MICROSOFT_CLIENT_SECRET', '');
    this.tenantId = config.get<string>('MICROSOFT_TENANT_ID', 'common');
    this.redirectUri = config.get<string>('MICROSOFT_REDIRECT_URI', '');
  }

  private buildMsal(credentials?: MicrosoftCredentials): ConfidentialClientApplication {
    return new ConfidentialClientApplication({
      auth: {
        clientId: credentials?.clientId || this.defaultClientId,
        clientSecret: credentials?.clientSecret || this.defaultClientSecret,
        authority: `https://login.microsoftonline.com/${this.tenantId}`,
      },
    });
  }

  getAuthUrl(state: string, credentials?: MicrosoftCredentials): string {
    return this.buildAuthUrl(state, this.redirectUri, ['Calendars.Read'], credentials);
  }

  getAnonAuthUrl(state: string, redirectUri: string, credentials?: MicrosoftCredentials): string {
    return this.buildAuthUrl(state, redirectUri, ['Calendars.Read.Shared'], credentials);
  }

  private buildAuthUrl(state: string, redirectUri: string, scopes: string[], credentials?: MicrosoftCredentials): string {
    const clientId = credentials?.clientId || this.defaultClientId;
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: [...scopes, 'offline_access', 'openid'].join(' '),
      state,
      prompt: 'consent',
    });
    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  async exchangeCode(code: string, credentials?: MicrosoftCredentials): Promise<TokenSet> {
    return this.exchange(code, this.redirectUri, credentials);
  }

  async exchangeCodeWithRedirect(code: string, redirectUri: string, credentials?: MicrosoftCredentials): Promise<TokenSet> {
    return this.exchange(code, redirectUri, credentials);
  }

  private async exchange(code: string, redirectUri: string, credentials?: MicrosoftCredentials): Promise<TokenSet> {
    const msal = this.buildMsal(credentials);
    const result = await msal.acquireTokenByCode({
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

  async refreshToken(refreshToken: string, credentials?: MicrosoftCredentials): Promise<TokenSet> {
    const msal = this.buildMsal(credentials);
    const result = await msal.acquireTokenByRefreshToken({
      refreshToken,
      scopes: ['Calendars.Read', 'offline_access'],
    });
    return {
      accessToken: result!.accessToken,
      refreshToken: (result as any).refreshToken ?? refreshToken,
      expiresAt: result!.expiresOn!,
    };
  }

  async getFreeBusy(accessToken: string, _calendarId: string, timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
    const client = Client.init({ authProvider: (done) => done(null, accessToken) });
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
