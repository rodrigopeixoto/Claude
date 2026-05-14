import { Module } from '@nestjs/common';
import { CryptoModule } from '../common/crypto/crypto.module';
import { CalendarsService } from './calendars.service';
import { CalendarsController } from './calendars.controller';
import { GoogleCalendarProvider } from './providers/google.provider';
import { MicrosoftCalendarProvider } from './providers/microsoft.provider';

@Module({
  imports: [CryptoModule],
  providers: [CalendarsService, GoogleCalendarProvider, MicrosoftCalendarProvider],
  controllers: [CalendarsController],
  exports: [CalendarsService],
})
export class CalendarsModule {}
