import { Module } from '@nestjs/common';
import { OutreachService } from './outreach.service';
import { OutreachController } from './outreach.controller';
import { OutreachLimitsService } from './outreach-limits.service';

@Module({
  providers: [OutreachService, OutreachLimitsService],
  controllers: [OutreachController],
})
export class OutreachModule {}
