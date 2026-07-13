import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { IsArray, IsOptional, MinLength } from 'class-validator';
import { ApiKeysService } from './api-keys.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateApiKeyDto {
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsArray()
  scopes?: string[];
}

@Controller('api-keys')
export class ApiKeysController {
  constructor(private apiKeys: ApiKeysService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateApiKeyDto) {
    return this.apiKeys.create(user.id, dto.name, dto.scopes);
  }

  @Get()
  list(@CurrentUser() user: any) {
    return this.apiKeys.list(user.id);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: any, @Param('id') id: string) {
    return this.apiKeys.revoke(user.id, id);
  }
}
