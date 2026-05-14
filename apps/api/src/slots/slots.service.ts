import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarsService } from '../calendars/calendars.service';
import { BusyInterval } from '../calendars/providers/calendar-provider.interface';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface TimeSlot {
  start: string;
  end: string;
  connectedParticipants: number;
  totalParticipants: number;
}

@Injectable()
export class SlotsService {
  constructor(
    private prisma: PrismaService,
    private calendars: CalendarsService,
  ) {}

  async getAvailableSlots(meetingId: string): Promise<TimeSlot[]> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { participants: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const { dateRangeStart, dateRangeEnd, timeWindowStart, timeWindowEnd, durationMin, timezone: tz, organizerId } = meeting;

    // Collect all busy intervals: organizer + connected participants
    const busySets: BusyInterval[][] = [];

    const orgBusy = await this.calendars.getFreeBusyForUser(organizerId, dateRangeStart, dateRangeEnd);
    busySets.push(orgBusy);

    const connectedParticipants = meeting.participants.filter((p) => p.status === 'CONNECTED');

    for (const participant of connectedParticipants) {
      const busy = await this.calendars.getFreeBusyForParticipant(participant.id, dateRangeStart, dateRangeEnd);
      busySets.push(busy);
    }

    // Generate candidate slots
    const candidates = this.generateCandidates(
      dateRangeStart,
      dateRangeEnd,
      timeWindowStart,
      timeWindowEnd,
      durationMin,
      tz,
    );

    // Filter slots where no participant has a conflict
    const allBusy = busySets.flat();
    const available = candidates.filter((slot) => !this.hasConflict(slot, allBusy));

    return available.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      connectedParticipants: connectedParticipants.length,
      totalParticipants: meeting.participants.length,
    }));
  }

  private generateCandidates(
    rangeStart: Date,
    rangeEnd: Date,
    windowStart: string,
    windowEnd: string,
    durationMin: number,
    tz: string,
  ): { start: Date; end: Date }[] {
    const slots: { start: Date; end: Date }[] = [];
    const [winStartH, winStartM] = windowStart.split(':').map(Number);
    const [winEndH, winEndM] = windowEnd.split(':').map(Number);

    let cursor = dayjs(rangeStart).tz(tz).startOf('day');
    const end = dayjs(rangeEnd).tz(tz).endOf('day');

    while (cursor.isBefore(end)) {
      const dayStart = cursor.hour(winStartH).minute(winStartM).second(0);
      const dayEnd = cursor.hour(winEndH).minute(winEndM).second(0);

      let slotStart = dayStart;
      while (slotStart.add(durationMin, 'minute').isBefore(dayEnd) ||
             slotStart.add(durationMin, 'minute').isSame(dayEnd)) {
        const slotEnd = slotStart.add(durationMin, 'minute');
        slots.push({ start: slotStart.toDate(), end: slotEnd.toDate() });
        slotStart = slotEnd;
      }

      cursor = cursor.add(1, 'day');
    }

    return slots;
  }

  private hasConflict(
    slot: { start: Date; end: Date },
    busyIntervals: BusyInterval[],
  ): boolean {
    for (const busy of busyIntervals) {
      // Overlap: slot.start < busy.end AND slot.end > busy.start
      if (slot.start < busy.end && slot.end > busy.start) return true;
    }
    return false;
  }
}
