import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateApiKeyDto {
  @ApiPropertyOptional({ example: 'My Integration' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: ['meetings:read'] })
  @IsOptional()
  @IsArray()
  scopes?: string[];
}

@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('auth/api-keys')
export class ApiKeysController {
  constructor(private service: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Create an API key for system-to-system integration' })
  create(@CurrentUser() user: any, @Body() dto: CreateApiKeyDto) {
    return this.service.create(user.id, dto.name, dto.scopes);
  }

  @Get()
  @ApiOperation({ summary: 'List your API keys' })
  list(@CurrentUser() user: any) {
    return this.service.list(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key' })
  revoke(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.revoke(user.id, id);
  }
}
