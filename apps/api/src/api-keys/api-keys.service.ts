import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, name: string, scopes?: string[]) {
    const raw = `sk_${randomBytes(32).toString('hex')}`;
    const keyHash = await bcrypt.hash(raw, 12);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash,
        scopes: scopes ?? ['meetings:read', 'meetings:write'],
      },
      select: { id: true, name: true, scopes: true, createdAt: true },
    });

    return { ...apiKey, key: raw };
  }

  async list(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      select: { id: true, name: true, scopes: true, createdAt: true, lastUsedAt: true },
    });
  }

  async revoke(userId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, userId } });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.delete({ where: { id } });
  }

  async validateKey(rawKey: string) {
    const keys = await this.prisma.apiKey.findMany({
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    for (const k of keys) {
      if (await bcrypt.compare(rawKey, k.keyHash)) {
        await this.prisma.apiKey.update({
          where: { id: k.id },
          data: { lastUsedAt: new Date() },
        });
        return k.user;
      }
    }
    return null;
  }
}
