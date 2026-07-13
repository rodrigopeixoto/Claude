import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { IsArray, IsUrl } from 'class-validator';
import { WebhooksService } from './webhooks.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateWebhookDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  events!: string[];
}

@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooks: WebhooksService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(user.id, dto.url, dto.events);
  }

  @Get()
  list(@CurrentUser() user: any) {
    return this.webhooks.list(user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.webhooks.remove(user.id, id);
  }
}
