import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { MockEnrichmentProvider } from './providers/mock-enrichment.provider';
import { ENRICHMENT_PROVIDER } from './providers/enrichment-provider.interface';
import { IcpModule } from '../icp/icp.module';

@Module({
  imports: [IcpModule],
  providers: [
    LeadsService,
    MockEnrichmentProvider,
    // Swap the useClass below for a real provider implementation to go live.
    { provide: ENRICHMENT_PROVIDER, useClass: MockEnrichmentProvider },
  ],
  controllers: [LeadsController],
  exports: [LeadsService],
})
export class LeadsModule {}
