import { Controller, Post, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ParticipantsService } from './participants.service';
import { AddParticipantDto } from './dto/participant.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('participants')
@ApiBearerAuth()
@Controller('meetings/:meetingId/participants')
export class ParticipantsController {
  constructor(private service: ParticipantsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a participant and send invite email' })
  add(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user: any,
    @Body() dto: AddParticipantDto,
  ) {
    return this.service.addToMeeting(meetingId, user.id, dto.email, dto.name);
  }

  @Delete(':participantId')
  @ApiOperation({ summary: 'Remove a participant' })
  remove(
    @Param('meetingId') meetingId: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.remove(meetingId, user.id, participantId);
  }

  @Post(':participantId/resend')
  @ApiOperation({ summary: 'Resend invite to a participant' })
  resend(
    @Param('meetingId') meetingId: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.resendInvite(meetingId, user.id, participantId);
  }
}
