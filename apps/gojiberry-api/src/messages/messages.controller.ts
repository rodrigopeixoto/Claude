import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { MessagesService } from './messages.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class GenerateMessageDto {
  @IsString()
  leadId!: string;

  @IsOptional()
  @IsString()
  campaignId?: string;
}

class UpdateMessageDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;
}

@Controller('messages')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Post('generate')
  generate(@CurrentUser() user: any, @Body() dto: GenerateMessageDto) {
    return this.messages.generateForLead(user.id, dto.leadId, dto.campaignId);
  }

  @Get()
  list(@CurrentUser() user: any, @Query('leadId') leadId?: string) {
    return this.messages.list(user.id, leadId);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateMessageDto) {
    return this.messages.update(user.id, id, dto);
  }

  @Post(':id/send')
  send(@CurrentUser() user: any, @Param('id') id: string) {
    return this.messages.send(user.id, id);
  }
}
