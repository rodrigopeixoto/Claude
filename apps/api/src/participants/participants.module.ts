import { Module } from '@nestjs/common';
import { ParticipantsService } from './participants.service';
import { ParticipantsController } from './participants.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [ParticipantsService],
  controllers: [ParticipantsController],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
