import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OutreachService } from './outreach.service';
import { CreateDraftDto, GenerateDraftDto, MarkStatusDto, UpdateDraftDto } from './dto/outreach.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@ApiTags('outreach')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('outreach')
export class OutreachController {
  constructor(private outreach: OutreachService) {}

  @Get()
  @ApiOperation({ summary: 'List outreach items, optionally filtered by status' })
  findAll(@Query('status') status?: string) {
    return this.outreach.findAll(status);
  }

  @Post('drafts')
  @ApiOperation({ summary: 'Create a manually-written draft outreach message for a lead' })
  createDraft(@Body() dto: CreateDraftDto) {
    return this.outreach.createDraft(dto.leadId, dto.type, dto.draftText);
  }

  @Post('drafts/generate')
  @ApiOperation({ summary: 'Generate a draft from a template, filling in lead/post placeholders' })
  generateDraft(@Body() dto: GenerateDraftDto) {
    return this.outreach.generateDraft(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit the text of a draft or queued item' })
  updateDraft(@Param('id') id: string, @Body() dto: UpdateDraftDto) {
    return this.outreach.updateDraft(id, dto.draftText);
  }

  @Post(':id/queue')
  @ApiOperation({ summary: 'Move a draft into the send queue' })
  queue(@Param('id') id: string) {
    return this.outreach.queue(id);
  }

  @Get('queue')
  @ApiOperation({ summary: "Get today's queue plus current limit/business-hours status" })
  getQueue() {
    return this.outreach.getQueue();
  }

  @Get('stats')
  @ApiOperation({ summary: "Get today's sent counts, limits, and business-hours status" })
  getStats() {
    return this.outreach.getStats();
  }

  @Get('due-for-withdrawal')
  @ApiOperation({ summary: 'List sent connection requests older than the configured withdraw window' })
  getDueForWithdrawal() {
    return this.outreach.getDueForWithdrawal();
  }

  @Post(':id/mark-sent')
  @ApiOperation({ summary: 'Mark a queued item as sent — YOU must have sent it manually on LinkedIn first. Enforces business hours and daily limits.' })
  markSent(@Param('id') id: string) {
    return this.outreach.markSent(id);
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Update the status of a sent item (accepted, replied, skipped, withdrawn)' })
  markStatus(@Param('id') id: string, @Body() dto: MarkStatusDto) {
    return this.outreach.markStatus(id, dto.status);
  }
}
