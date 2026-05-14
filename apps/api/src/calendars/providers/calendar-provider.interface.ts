export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface CalendarProvider {
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  getFreeBusy(accessToken: string, calendarId: string, timeMin: Date, timeMax: Date): Promise<BusyInterval[]>;
}
