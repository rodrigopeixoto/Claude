import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { MessagesModule } from '../messages/messages.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [MessagesModule, WebhooksModule],
  providers: [CampaignsService],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
