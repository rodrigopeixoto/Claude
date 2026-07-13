import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../common/ai/ai.service';

@Injectable()
export class IcpService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  async createFromPrompt(userId: string, prompt: string) {
    const { name, criteria } = await this.ai.parsePromptToIcp(prompt);
    return this.prisma.icpProfile.create({
      data: { userId, name, prompt, criteria: criteria as any },
    });
  }

  list(userId: string) {
    return this.prisma.icpProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { leads: true } } },
    });
  }

  async findOne(userId: string, id: string) {
    const icp = await this.prisma.icpProfile.findFirst({ where: { id, userId } });
    if (!icp) throw new NotFoundException('ICP profile not found');
    return icp;
  }
}
