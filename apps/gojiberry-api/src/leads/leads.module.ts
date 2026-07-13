import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { MockEnrichmentProvider } from './providers/mock-enrichment.provider';
import { ApolloEnrichmentProvider } from './providers/apollo-enrichment.provider';
import { ENRICHMENT_PROVIDER } from './providers/enrichment-provider.interface';
import { IcpModule } from '../icp/icp.module';

@Module({
  imports: [IcpModule],
  providers: [
    LeadsService,
    MockEnrichmentProvider,
    ApolloEnrichmentProvider,
    // Real company enrichment via Apollo.io (falls back to mock without an
    // APOLLO_API_KEY, without a company domain, or on API failure).
    { provide: ENRICHMENT_PROVIDER, useClass: ApolloEnrichmentProvider },
  ],
  controllers: [LeadsController],
  exports: [LeadsService],
})
export class LeadsModule {}
