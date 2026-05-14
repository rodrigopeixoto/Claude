import { Controller, Get, Post, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InviteService } from './invite.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('invite')
@Public()
@Controller('invite')
export class InviteController {
  constructor(
    private service: InviteService,
    private config: ConfigService,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'Get invite details (public, no auth required)' })
  getDetails(@Param('token') token: string) {
    return this.service.getInviteDetails(token);
  }

  @Get(':token/connect/google')
  @ApiOperation({ summary: 'Start anonymous Google Calendar OAuth' })
  googleConnect(@Param('token') token: string, @Res() res: any) {
    const url = this.service.getGoogleAuthUrl(token);
    return res.redirect(url);
  }

  @Get(':token/connect/microsoft')
  @ApiOperation({ summary: 'Start anonymous Microsoft Calendar OAuth' })
  microsoftConnect(@Param('token') token: string, @Res() res: any) {
    const url = this.service.getMicrosoftAuthUrl(token);
    return res.redirect(url);
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google anonymous OAuth callback (internal)' })
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: any) {
    await this.service.handleGoogleCallback(code, state);
    return res.redirect(`${this.config.get('WEB_URL')}/invite/success`);
  }

  @Get('microsoft/callback')
  @ApiOperation({ summary: 'Microsoft anonymous OAuth callback (internal)' })
  async microsoftCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: any) {
    await this.service.handleMicrosoftCallback(code, state);
    return res.redirect(`${this.config.get('WEB_URL')}/invite/success`);
  }

  @Post(':token/decline')
  @ApiOperation({ summary: 'Decline the invitation' })
  decline(@Param('token') token: string) {
    return this.service.decline(token);
  }
}
