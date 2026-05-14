import { Controller, Get, Delete, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
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

  @Get('auth/google')
  @ApiOperation({ summary: 'Get Google OAuth URL for connecting calendar' })
  @ApiQuery({ name: 'configId', required: false })
  async googleAuthUrl(@CurrentUser() user: any, @Query('configId') configId?: string) {
    const url = await this.service.getGoogleAuthUrlWithConfig(user.id, configId);
    return { url };
  }

  @Get('auth/microsoft')
  @ApiOperation({ summary: 'Get Microsoft OAuth URL for connecting calendar' })
  @ApiQuery({ name: 'configId', required: false })
  async microsoftAuthUrl(@CurrentUser() user: any, @Query('configId') configId?: string) {
    const url = await this.service.getMicrosoftAuthUrlWithConfig(user.id, configId);
    return { url };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Disconnect a calendar' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deleteConnection(user.id, id);
  }
}
