import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { GoogleCalendarProvider } from './providers/google.provider';
import { MicrosoftCalendarProvider } from './providers/microsoft.provider';
import { CalendarProvider as ProviderEnum } from '@prisma/client';
import { BusyInterval } from './providers/calendar-provider.interface';
import { REDIS_CLIENT } from '../redis/redis.module';
import type Redis from 'ioredis';

@Injectable()
export class CalendarsService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private config: ConfigService,
    private google: GoogleCalendarProvider,
    private microsoft: MicrosoftCalendarProvider,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  // ── Organizer OAuth ──────────────────────────────────────────────────────

  getGoogleAuthUrl(userId: string, configId?: string): string {
    const state = this.encodeState({ userId, provider: 'GOOGLE', configId });
    return this.google.getAuthUrl(state);
  }

  getMicrosoftAuthUrl(userId: string, configId?: string): string {
    const state = this.encodeState({ userId, provider: 'MICROSOFT', configId });
    return this.microsoft.getAuthUrl(state);
  }

  async getGoogleAuthUrlWithConfig(userId: string, configId?: string): Promise<string> {
    const credentials = configId ? await this.loadCredentials(userId, configId) : undefined;
    const state = this.encodeState({ userId, provider: 'GOOGLE', configId });
    return this.google.getAuthUrl(state, credentials as any);
  }

  async getMicrosoftAuthUrlWithConfig(userId: string, configId?: string): Promise<string> {
    const credentials = configId ? await this.loadCredentials(userId, configId) : undefined;
    const state = this.encodeState({ userId, provider: 'MICROSOFT', configId });
    return this.microsoft.getAuthUrl(state, credentials as any);
  }

  async handleGoogleCallback(code: string, state: string) {
    const { userId, configId } = this.decodeState(state);
    const credentials = configId ? await this.loadCredentials(userId, configId) : undefined;
    const tokens = await this.google.exchangeCode(code, credentials as any);
    return this.upsertConnection(userId, ProviderEnum.GOOGLE, tokens);
  }

  async handleMicrosoftCallback(code: string, state: string) {
    const { userId, configId } = this.decodeState(state);
    const credentials = configId ? await this.loadCredentials(userId, configId) : undefined;
    const tokens = await this.microsoft.exchangeCode(code, credentials as any);
    return this.upsertConnection(userId, ProviderEnum.MICROSOFT, tokens);
  }

  private async upsertConnection(userId: string, provider: ProviderEnum, tokens: any) {
    return this.prisma.calendarConnection.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId, provider,
        accessToken: this.crypto.encrypt(tokens.accessToken),
        refreshToken: this.crypto.encrypt(tokens.refreshToken),
        tokenExpiry: tokens.expiresAt,
      },
      update: {
        accessToken: this.crypto.encrypt(tokens.accessToken),
        refreshToken: this.crypto.encrypt(tokens.refreshToken),
        tokenExpiry: tokens.expiresAt,
      },
    });
  }

  // ── Anonymous OAuth (invite flow) ────────────────────────────────────────

  getGoogleAnonAuthUrl(inviteToken: string): string {
    const state = this.encodeState({ inviteToken, provider: 'GOOGLE' });
    const redirectUri = this.config.get<string>('GOOGLE_ANON_REDIRECT_URI', '');
    return this.google.getAnonAuthUrl(state, redirectUri);
  }

  getMicrosoftAnonAuthUrl(inviteToken: string): string {
    const state = this.encodeState({ inviteToken, provider: 'MICROSOFT' });
    const redirectUri = this.config.get<string>('MICROSOFT_ANON_REDIRECT_URI', '');
    return this.microsoft.getAnonAuthUrl(state, redirectUri);
  }

  async handleGoogleAnonCallback(code: string, state: string) {
    const { inviteToken } = this.decodeState(state);
    const redirectUri = this.config.get<string>('GOOGLE_ANON_REDIRECT_URI', '');
    const tokens = await this.google.exchangeCodeWithRedirect(code, redirectUri);
    return { inviteToken, tokens, provider: ProviderEnum.GOOGLE };
  }

  async handleMicrosoftAnonCallback(code: string, state: string) {
    const { inviteToken } = this.decodeState(state);
    const redirectUri = this.config.get<string>('MICROSOFT_ANON_REDIRECT_URI', '');
    const tokens = await this.microsoft.exchangeCodeWithRedirect(code, redirectUri);
    return { inviteToken, tokens, provider: ProviderEnum.MICROSOFT };
  }

  // ── Free/Busy Aggregation ─────────────────────────────────────────────────

  async getFreeBusyForUser(userId: string, timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
    const connections = await this.prisma.calendarConnection.findMany({ where: { userId } });
    const all: BusyInterval[] = [];
    for (const conn of connections) {
      const intervals = await this.fetchFreeBusy(
        conn.provider, this.crypto.decrypt(conn.accessToken),
        conn.calendarId, timeMin, timeMax,
      );
      all.push(...intervals);
    }
    return all;
  }

  async getFreeBusyForParticipant(participantId: string, timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
    const access = await this.prisma.anonymousCalendarAccess.findUnique({ where: { participantId } });
    if (!access) return [];
    return this.fetchFreeBusy(
      access.provider, this.crypto.decrypt(access.accessToken),
      access.calendarId, timeMin, timeMax,
    );
  }

  private async fetchFreeBusy(
    provider: ProviderEnum, accessToken: string,
    calendarId: string, timeMin: Date, timeMax: Date,
  ): Promise<BusyInterval[]> {
    if (provider === ProviderEnum.GOOGLE) {
      return this.google.getFreeBusy(accessToken, calendarId, timeMin, timeMax);
    }
    return this.microsoft.getFreeBusy(accessToken, calendarId, timeMin, timeMax);
  }

  // ── Manage connections ────────────────────────────────────────────────────

  async listConnections(userId: string) {
    return this.prisma.calendarConnection.findMany({
      where: { userId },
      select: { id: true, provider: true, calendarId: true, createdAt: true },
    });
  }

  async deleteConnection(userId: string, id: string) {
    const conn = await this.prisma.calendarConnection.findFirst({ where: { id, userId } });
    if (!conn) throw new NotFoundException('Connection not found');
    await this.prisma.calendarConnection.delete({ where: { id } });
  }

  async saveAnonymousAccess(participantId: string, provider: ProviderEnum, tokens: any) {
    return this.prisma.anonymousCalendarAccess.upsert({
      where: { participantId },
      create: {
        participantId, provider,
        accessToken: this.crypto.encrypt(tokens.accessToken),
        refreshToken: this.crypto.encrypt(tokens.refreshToken),
        tokenExpiry: tokens.expiresAt,
      },
      update: {
        provider,
        accessToken: this.crypto.encrypt(tokens.accessToken),
        refreshToken: this.crypto.encrypt(tokens.refreshToken),
        tokenExpiry: tokens.expiresAt,
      },
    });
  }

  // ── OAuth state helpers ───────────────────────────────────────────────────

  private encodeState(data: object): string {
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }

  private decodeState(state: string): any {
    try {
      return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }
  }

  // ── Load custom credentials from DB ──────────────────────────────────────

  private async loadCredentials(userId: string, configId: string) {
    const config = await this.prisma.oAuthConfig.findFirst({ where: { id: configId, userId } });
    if (!config) return undefined;
    return {
      clientId: config.clientId,
      clientSecret: this.crypto.decrypt(config.clientSecret),
    };
  }
}
