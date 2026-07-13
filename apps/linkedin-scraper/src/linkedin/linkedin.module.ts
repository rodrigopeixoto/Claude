import { Module } from '@nestjs/common';
import { LinkedinService } from './linkedin.service';
import { LinkedinController } from './linkedin.controller';

@Module({
  providers: [LinkedinService],
  controllers: [LinkedinController],
  exports: [LinkedinService],
})
export class LinkedinModule {}
