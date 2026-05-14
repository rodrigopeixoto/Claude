import { Controller, Post, Body, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CalendarsService } from '../calendars/calendars.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private calendars: CalendarsService,
    private config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.name, dto.password);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login and receive JWT token' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('google')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start Google OAuth flow to connect your calendar' })
  googleConnect(@CurrentUser() user: any, @Res() res: any) {
    const url = this.calendars.getGoogleAuthUrl(user.id);
    return res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback (internal)' })
  async googleCallback(@Req() req: any, @Res() res: any) {
    const { code, state } = req.query;
    await this.calendars.handleGoogleCallback(code, state);
    return res.redirect(`${this.config.get('WEB_URL')}/app/dashboard?connected=google`);
  }

  @Get('microsoft')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start Microsoft OAuth flow to connect your calendar' })
  microsoftConnect(@CurrentUser() user: any, @Res() res: any) {
    const url = this.calendars.getMicrosoftAuthUrl(user.id);
    return res.redirect(url);
  }

  @Public()
  @Get('microsoft/callback')
  @ApiOperation({ summary: 'Microsoft OAuth callback (internal)' })
  async microsoftCallback(@Req() req: any, @Res() res: any) {
    const { code, state } = req.query;
    await this.calendars.handleMicrosoftCallback(code, state);
    return res.redirect(`${this.config.get('WEB_URL')}/app/dashboard?connected=microsoft`);
  }
}
