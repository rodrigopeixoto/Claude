export type MeetingStatus = 'DRAFT' | 'OPEN' | 'CONFIRMED' | 'CANCELLED';
export type ParticipantStatus = 'PENDING' | 'CONNECTED' | 'DECLINED';
export type CalendarProvider = 'GOOGLE' | 'MICROSOFT';

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  durationMin: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  timezone: string;
  status: MeetingStatus;
  confirmedSlotStart?: string;
  participants: Participant[];
  createdAt: string;
}

export interface Participant {
  id: string;
  email: string;
  name?: string;
  status: ParticipantStatus;
  provider?: CalendarProvider;
}

export interface TimeSlot {
  start: string;
  end: string;
  connectedParticipants: number;
  totalParticipants: number;
}

export interface CreateMeetingInput {
  title: string;
  description?: string;
  durationMin: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  timezone: string;
}

export interface UpdateMeetingInput extends Partial<CreateMeetingInput> {}

export interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  createdAt: string;
}

export interface CalendarConnection {
  id: string;
  provider: CalendarProvider;
  calendarId: string;
  createdAt: string;
}
