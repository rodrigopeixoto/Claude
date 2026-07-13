import { Module } from '@nestjs/common';
import { IcpService } from './icp.service';
import { IcpController } from './icp.controller';

@Module({
  providers: [IcpService],
  controllers: [IcpController],
  exports: [IcpService],
})
export class IcpModule {}
