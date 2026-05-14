import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto, UpdateMeetingDto } from './dto/meeting.dto';
import { MeetingStatus } from '@prisma/client';

@Injectable()
export class MeetingsService {
  constructor(private prisma: PrismaService) {}

  async create(organizerId: string, dto: CreateMeetingDto) {
    return this.prisma.meeting.create({
      data: {
        organizerId,
        title: dto.title,
        description: dto.description,
        durationMin: dto.durationMin,
        dateRangeStart: new Date(dto.dateRangeStart),
        dateRangeEnd: new Date(dto.dateRangeEnd),
        timeWindowStart: dto.timeWindowStart,
        timeWindowEnd: dto.timeWindowEnd,
        timezone: dto.timezone,
        status: MeetingStatus.OPEN,
      },
      include: { participants: true },
    });
  }

  async findAll(userId: string) {
    return this.prisma.meeting.findMany({
      where: { organizerId: userId },
      include: { participants: { select: { id: true, email: true, name: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: { participants: { select: { id: true, email: true, name: true, status: true, provider: true } } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  async update(id: string, userId: string, dto: UpdateMeetingDto) {
    const meeting = await this.assertOwner(id, userId);
    this.assertEditable(meeting.status);
    return this.prisma.meeting.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.durationMin && { durationMin: dto.durationMin }),
        ...(dto.dateRangeStart && { dateRangeStart: new Date(dto.dateRangeStart) }),
        ...(dto.dateRangeEnd && { dateRangeEnd: new Date(dto.dateRangeEnd) }),
        ...(dto.timeWindowStart && { timeWindowStart: dto.timeWindowStart }),
        ...(dto.timeWindowEnd && { timeWindowEnd: dto.timeWindowEnd }),
        ...(dto.timezone && { timezone: dto.timezone }),
      },
    });
  }

  async cancel(id: string, userId: string) {
    const meeting = await this.assertOwner(id, userId);
    this.assertEditable(meeting.status);
    return this.prisma.meeting.update({
      where: { id },
      data: { status: MeetingStatus.CANCELLED },
    });
  }

  async confirm(id: string, userId: string, slotStart: string) {
    const meeting = await this.assertOwner(id, userId);
    if (meeting.status !== MeetingStatus.OPEN) {
      throw new BadRequestException('Meeting is not open for confirmation');
    }
    const start = new Date(slotStart);
    return this.prisma.meeting.update({
      where: { id },
      data: {
        status: MeetingStatus.CONFIRMED,
        confirmedAt: new Date(),
        confirmedSlotStart: start,
      },
    });
  }

  private async assertOwner(id: string, userId: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.organizerId !== userId) throw new ForbiddenException();
    return meeting;
  }

  private assertEditable(status: MeetingStatus) {
    if (status === MeetingStatus.CONFIRMED || status === MeetingStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit a confirmed or cancelled meeting');
    }
  }
}
