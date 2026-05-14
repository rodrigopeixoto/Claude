import { Module } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { CalendarsModule } from '../calendars/calendars.module';

@Module({
  imports: [CalendarsModule],
  providers: [SlotsService],
  exports: [SlotsService],
})
export class SlotsModule {}
