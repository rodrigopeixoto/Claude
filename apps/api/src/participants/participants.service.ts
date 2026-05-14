import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as dayjs from 'dayjs';

@Injectable()
export class ParticipantsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async addToMeeting(meetingId: string, organizerId: string, email: string, name?: string) {
    const meeting = await this.assertOrganizer(meetingId, organizerId);

    const existing = await this.prisma.participant.findUnique({
      where: { meetingId_email: { meetingId, email } },
    });
    if (existing) throw new ConflictException('Participant already added');

    const participant = await this.prisma.participant.create({
      data: { meetingId, email, name },
    });

    // Create invite token (expires in 7 days)
    const inviteToken = await this.prisma.inviteToken.create({
      data: {
        participantId: participant.id,
        expiresAt: dayjs().add(7, 'day').toDate(),
      },
    });

    await this.notifications.sendInvite(participant.email, participant.name, meeting, inviteToken.token);

    return participant;
  }

  async remove(meetingId: string, organizerId: string, participantId: string) {
    await this.assertOrganizer(meetingId, organizerId);

    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, meetingId },
    });
    if (!participant) throw new NotFoundException('Participant not found');

    await this.prisma.participant.delete({ where: { id: participantId } });
  }

  async resendInvite(meetingId: string, organizerId: string, participantId: string) {
    const meeting = await this.assertOrganizer(meetingId, organizerId);

    const participant = await this.prisma.participant.findFirst({
      where: { id: participantId, meetingId },
    });
    if (!participant) throw new NotFoundException('Participant not found');

    // Expire old tokens, create new one
    await this.prisma.inviteToken.updateMany({
      where: { participantId, usedAt: null },
      data: { expiresAt: new Date() },
    });

    const inviteToken = await this.prisma.inviteToken.create({
      data: {
        participantId,
        expiresAt: dayjs().add(7, 'day').toDate(),
      },
    });

    await this.notifications.sendInvite(participant.email, participant.name, meeting, inviteToken.token);

    return { message: 'Invite resent' };
  }

  private async assertOrganizer(meetingId: string, organizerId: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.organizerId !== organizerId) throw new ForbiddenException();
    return meeting;
  }
}
