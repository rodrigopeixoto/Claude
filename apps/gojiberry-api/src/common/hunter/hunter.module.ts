import { Global, Module } from '@nestjs/common';
import { HunterService } from './hunter.service';

@Global()
@Module({
  providers: [HunterService],
  exports: [HunterService],
})
export class HunterModule {}
