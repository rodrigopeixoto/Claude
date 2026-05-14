import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OAuthConfigsService } from './oauth-configs.service';
import { CreateOAuthConfigDto } from './dto/oauth-config.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('oauth-configs')
@ApiBearerAuth()
@Controller('oauth-configs')
export class OAuthConfigsController {
  constructor(private service: OAuthConfigsService) {}

  @Post()
  @ApiOperation({ summary: 'Save a custom Google or Microsoft OAuth client credential' })
  create(@CurrentUser() user: any, @Body() dto: CreateOAuthConfigDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List saved OAuth configurations' })
  @ApiQuery({ name: 'provider', required: false, enum: ['GOOGLE', 'MICROSOFT'] })
  list(@CurrentUser() user: any, @Query('provider') provider?: string) {
    if (provider === 'GOOGLE' || provider === 'MICROSOFT') {
      return this.service.listByProvider(user.id, provider as any);
    }
    return this.service.list(user.id);
  }

  @Post(':id/default')
  @ApiOperation({ summary: 'Set this config as the default for its provider' })
  setDefault(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.setDefault(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove an OAuth configuration' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}
