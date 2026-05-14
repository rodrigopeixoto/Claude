import { Module } from '@nestjs/common';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { CalendarsModule } from '../calendars/calendars.module';

@Module({
  imports: [CalendarsModule],
  providers: [InviteService],
  controllers: [InviteController],
})
export class InviteModule {}
