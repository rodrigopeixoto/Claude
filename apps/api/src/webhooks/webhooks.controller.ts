import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsArray, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateWebhookDto {
  @ApiProperty({ example: 'https://myapp.com/webhooks/meet' })
  @IsUrl()
  url: string;

  @ApiProperty({ example: ['meeting.slot_confirmed', 'participant.connected'] })
  @IsArray()
  @IsString({ each: true })
  events: string[];
}

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private service: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Register a webhook endpoint' })
  create(@CurrentUser() user: any, @Body() dto: CreateWebhookDto) {
    return this.service.create(user.id, dto.url, dto.events);
  }

  @Get()
  @ApiOperation({ summary: 'List registered webhooks' })
  list(@CurrentUser() user: any) {
    return this.service.list(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a webhook' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}
