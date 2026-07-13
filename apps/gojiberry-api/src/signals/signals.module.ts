import { Module } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SignalsController } from './signals.controller';
import { MockSignalProvider } from './providers/mock-signal.provider';
import { SIGNAL_PROVIDER } from './providers/signal-provider.interface';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [WebhooksModule],
  providers: [
    SignalsService,
    MockSignalProvider,
    // Swap the useClass below for a real, ToS-compliant provider to go live.
    { provide: SIGNAL_PROVIDER, useClass: MockSignalProvider },
  ],
  controllers: [SignalsController],
  exports: [SignalsService],
})
export class SignalsModule {}
