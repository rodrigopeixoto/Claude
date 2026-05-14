import { Test } from '@nestjs/testing';
import { SlotsService } from './slots.service';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarsService } from '../calendars/calendars.service';

const mockPrisma = {
  meeting: {
    findUnique: jest.fn(),
  },
};

const mockCalendars = {
  getFreeBusyForUser: jest.fn(),
  getFreeBusyForParticipant: jest.fn(),
};

describe('SlotsService', () => {
  let service: SlotsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SlotsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CalendarsService, useValue: mockCalendars },
      ],
    }).compile();

    service = module.get(SlotsService);
  });

  it('should return empty slots when organizer has full day blocked', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: 'mtg1',
      organizerId: 'org1',
      durationMin: 60,
      dateRangeStart: new Date('2026-05-20T00:00:00Z'),
      dateRangeEnd: new Date('2026-05-20T23:59:59Z'),
      timeWindowStart: '09:00',
      timeWindowEnd: '17:00',
      timezone: 'UTC',
      participants: [],
    });

    // Organizer is busy all day
    mockCalendars.getFreeBusyForUser.mockResolvedValue([
      { start: new Date('2026-05-20T08:00:00Z'), end: new Date('2026-05-20T18:00:00Z') },
    ]);

    const slots = await service.getAvailableSlots('mtg1');
    expect(slots).toHaveLength(0);
  });

  it('should return slots when no busy intervals', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: 'mtg1',
      organizerId: 'org1',
      durationMin: 60,
      dateRangeStart: new Date('2026-05-20T00:00:00Z'),
      dateRangeEnd: new Date('2026-05-20T23:59:59Z'),
      timeWindowStart: '09:00',
      timeWindowEnd: '12:00',
      timezone: 'UTC',
      participants: [],
    });

    mockCalendars.getFreeBusyForUser.mockResolvedValue([]);

    const slots = await service.getAvailableSlots('mtg1');
    // 09:00-10:00, 10:00-11:00, 11:00-12:00 = 3 slots
    expect(slots).toHaveLength(3);
    expect(slots[0].start).toContain('09:00');
  });

  it('should exclude slots conflicting with participant busy time', async () => {
    mockPrisma.meeting.findUnique.mockResolvedValue({
      id: 'mtg1',
      organizerId: 'org1',
      durationMin: 60,
      dateRangeStart: new Date('2026-05-20T00:00:00Z'),
      dateRangeEnd: new Date('2026-05-20T23:59:59Z'),
      timeWindowStart: '09:00',
      timeWindowEnd: '12:00',
      timezone: 'UTC',
      participants: [{ id: 'p1', status: 'CONNECTED' }],
    });

    mockCalendars.getFreeBusyForUser.mockResolvedValue([]);
    // Participant busy 10:00-11:00
    mockCalendars.getFreeBusyForParticipant.mockResolvedValue([
      { start: new Date('2026-05-20T10:00:00Z'), end: new Date('2026-05-20T11:00:00Z') },
    ]);

    const slots = await service.getAvailableSlots('mtg1');
    expect(slots).toHaveLength(2);
    const starts = slots.map((s) => s.start);
    expect(starts.some((s) => s.includes('10:00'))).toBe(false);
  });
});
