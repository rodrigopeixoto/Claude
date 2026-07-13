import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LeadsService } from './leads.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class GenerateLeadsDto {
  @IsString()
  icpProfileId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  count?: number;
}

@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  @Post('generate')
  generate(@CurrentUser() user: any, @Body() dto: GenerateLeadsDto) {
    return this.leads.generateFromIcp(user.id, dto.icpProfileId, dto.count ?? 10);
  }

  @Get()
  list(@CurrentUser() user: any, @Query('icpProfileId') icpProfileId?: string) {
    return this.leads.list(user.id, icpProfileId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.leads.findOne(user.id, id);
  }
}
