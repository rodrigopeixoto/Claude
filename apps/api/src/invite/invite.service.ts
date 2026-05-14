import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarsService } from '../calendars/calendars.service';
import { ParticipantStatus } from '@prisma/client';
import * as dayjs from 'dayjs';

@Injectable()
export class InviteService {
  constructor(
    private prisma: PrismaService,
    private calendars: CalendarsService,
  ) {}

  async getInviteDetails(token: string) {
    const invite = await this.findValidToken(token);
    const participant = await this.prisma.participant.findUnique({
      where: { id: invite.participantId },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            description: true,
            durationMin: true,
            dateRangeStart: true,
            dateRangeEnd: true,
            timezone: true,
            status: true,
          },
        },
      },
    });

    return {
      token,
      participant: {
        id: participant!.id,
        email: participant!.email,
        name: participant!.name,
        status: participant!.status,
      },
      meeting: participant!.meeting,
    };
  }

  getGoogleAuthUrl(token: string): string {
    return this.calendars.getGoogleAnonAuthUrl(token);
  }

  getMicrosoftAuthUrl(token: string): string {
    return this.calendars.getMicrosoftAnonAuthUrl(token);
  }

  async handleGoogleCallback(code: string, state: string) {
    const { inviteToken, tokens, provider } = await this.calendars.handleGoogleAnonCallback(code, state);
    return this.completeConnection(inviteToken, provider, tokens);
  }

  async handleMicrosoftCallback(code: string, state: string) {
    const { inviteToken, tokens, provider } = await this.calendars.handleMicrosoftAnonCallback(code, state);
    return this.completeConnection(inviteToken, provider, tokens);
  }

  async decline(token: string) {
    const invite = await this.findValidToken(token);
    await this.prisma.participant.update({
      where: { id: invite.participantId },
      data: { status: ParticipantStatus.DECLINED },
    });
    await this.prisma.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
    return { message: 'Invitation declined' };
  }

  private async completeConnection(inviteToken: string, provider: any, tokens: any) {
    const invite = await this.findValidToken(inviteToken);

    await this.calendars.saveAnonymousAccess(invite.participantId, provider, tokens);

    await this.prisma.participant.update({
      where: { id: invite.participantId },
      data: { status: ParticipantStatus.CONNECTED, provider },
    });

    await this.prisma.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return { success: true };
  }

  private async findValidToken(token: string) {
    const invite = await this.prisma.inviteToken.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.usedAt) throw new BadRequestException('Invite already used');
    if (dayjs().isAfter(invite.expiresAt)) throw new BadRequestException('Invite has expired');
    return invite;
  }
}
