import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class OutreachLimitsService {
  constructor(private config: ConfigService) {}

  get timezone(): string {
    return this.config.get<string>('TIMEZONE') || 'America/Sao_Paulo';
  }

  get businessHourStart(): number {
    return Number(this.config.get('BUSINESS_HOURS_START') ?? 9);
  }

  get businessHourEnd(): number {
    return Number(this.config.get('BUSINESS_HOURS_END') ?? 18);
  }

  /** 0=Sunday .. 6=Saturday. Defaults to Monday-Friday. */
  get businessDays(): number[] {
    const raw = this.config.get<string>('BUSINESS_DAYS') || '1,2,3,4,5';
    return raw.split(',').map((d) => Number(d.trim()));
  }

  get dailyConnectionLimit(): number {
    return Number(this.config.get('DAILY_CONNECTION_LIMIT') ?? 25);
  }

  get dailyMessageLimit(): number {
    return Number(this.config.get('DAILY_MESSAGE_LIMIT') ?? 40);
  }

  get dailyActionLimit(): number {
    return Number(this.config.get('DAILY_ACTION_LIMIT') ?? 200);
  }

  get withdrawAfterDays(): number {
    return Number(this.config.get('CONNECTION_WITHDRAW_DAYS') ?? 10);
  }

  isWithinBusinessHours(at: Date = new Date()): boolean {
    const local = dayjs(at).tz(this.timezone);
    return this.businessDays.includes(local.day()) &&
      local.hour() >= this.businessHourStart &&
      local.hour() < this.businessHourEnd;
  }

  /** UTC start/end instants of "today" in the configured timezone. */
  todayRange(at: Date = new Date()): { start: Date; end: Date } {
    const local = dayjs(at).tz(this.timezone);
    return {
      start: local.startOf('day').toDate(),
      end: local.endOf('day').toDate(),
    };
  }
}
