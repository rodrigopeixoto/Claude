import {
  Controller, Get, Post, Patch, Delete, Param, Body
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { SlotsService } from '../slots/slots.service';
import { CreateMeetingDto, UpdateMeetingDto, ConfirmSlotDto } from './dto/meeting.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('meetings')
@ApiBearerAuth()
@Controller('meetings')
export class MeetingsController {
  constructor(
    private meetings: MeetingsService,
    private slotsService: SlotsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new meeting proposal' })
  create(@CurrentUser() user: any, @Body() dto: CreateMeetingDto) {
    return this.meetings.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all your meetings' })
  findAll(@CurrentUser() user: any) {
    return this.meetings.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get meeting details' })
  findOne(@Param('id') id: string) {
    return this.meetings.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a meeting (only DRAFT or OPEN)' })
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateMeetingDto) {
    return this.meetings.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a meeting' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.meetings.cancel(id, user.id);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm a time slot for the meeting' })
  confirm(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ConfirmSlotDto) {
    return this.meetings.confirm(id, user.id, dto.slotStart);
  }

  @Get(':id/slots')
  @ApiOperation({ summary: 'Get available common time slots across all participants' })
  getSlots(@Param('id') id: string) {
    return this.slotsService.getAvailableSlots(id);
  }
}
