import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { CreateOAuthConfigDto } from './dto/oauth-config.dto';
import { CalendarProvider } from '@prisma/client';

@Injectable()
export class OAuthConfigsService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async create(userId: string, dto: CreateOAuthConfigDto) {
    if (dto.isDefault) {
      await this.prisma.oAuthConfig.updateMany({
        where: { userId, provider: dto.provider },
        data: { isDefault: false },
      });
    }

    const config = await this.prisma.oAuthConfig.create({
      data: {
        userId,
        provider: dto.provider,
        label: dto.label,
        clientId: dto.clientId,
        clientSecret: this.crypto.encrypt(dto.clientSecret),
        isDefault: dto.isDefault ?? false,
      },
    });

    return this.sanitize(config);
  }

  async list(userId: string) {
    const configs = await this.prisma.oAuthConfig.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return configs.map(this.sanitize);
  }

  async listByProvider(userId: string, provider: CalendarProvider) {
    const configs = await this.prisma.oAuthConfig.findMany({
      where: { userId, provider },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return configs.map(this.sanitize);
  }

  async getWithSecret(userId: string, configId: string) {
    const config = await this.prisma.oAuthConfig.findFirst({
      where: { id: configId, userId },
    });
    if (!config) throw new NotFoundException('OAuth config not found');
    return {
      ...this.sanitize(config),
      clientSecret: this.crypto.decrypt(config.clientSecret),
    };
  }

  async getDefaultWithSecret(userId: string, provider: CalendarProvider) {
    const config = await this.prisma.oAuthConfig.findFirst({
      where: { userId, provider },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!config) return null;
    return {
      ...this.sanitize(config),
      clientSecret: this.crypto.decrypt(config.clientSecret),
    };
  }

  async remove(userId: string, id: string) {
    const config = await this.prisma.oAuthConfig.findFirst({ where: { id, userId } });
    if (!config) throw new NotFoundException('OAuth config not found');
    await this.prisma.oAuthConfig.delete({ where: { id } });
  }

  async setDefault(userId: string, id: string) {
    const config = await this.prisma.oAuthConfig.findFirst({ where: { id, userId } });
    if (!config) throw new NotFoundException('OAuth config not found');
    await this.prisma.oAuthConfig.updateMany({
      where: { userId, provider: config.provider },
      data: { isDefault: false },
    });
    return this.sanitize(
      await this.prisma.oAuthConfig.update({ where: { id }, data: { isDefault: true } }),
    );
  }

  private sanitize(config: any) {
    const { clientSecret, ...safe } = config;
    return { ...safe, clientSecretHint: '••••••' + (this.tryDecrypt(clientSecret) || '').slice(-4) };
  }

  private tryDecrypt(value: string) {
    try { return this.crypto.decrypt(value); } catch { return ''; }
  }
}
