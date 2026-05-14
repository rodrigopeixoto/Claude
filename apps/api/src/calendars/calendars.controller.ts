import { Controller, Get, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CalendarsService } from './calendars.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('calendars')
@ApiBearerAuth()
@Controller('calendars')
export class CalendarsController {
  constructor(private service: CalendarsService) {}

  @Get()
  @ApiOperation({ summary: 'List connected calendars for the current user' })
  list(@CurrentUser() user: any) {
    return this.service.listConnections(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Disconnect a calendar' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteConnection(user.id, id);
  }
}
