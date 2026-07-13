import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignsService } from './campaigns.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CampaignStatus } from '@prisma/client';

class StepDto {
  @IsInt()
  @Min(0)
  order!: number;

  @IsInt()
  @Min(0)
  delayDays!: number;

  @IsOptional()
  @IsIn(['EMAIL', 'LINKEDIN'])
  channel?: 'EMAIL' | 'LINKEDIN';

  @IsOptional()
  @IsString()
  subjectTemplate?: string;

  @IsString()
  bodyTemplate!: string;
}

class CreateCampaignDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  icpProfileId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps!: StepDto[];
}

class EnrollDto {
  @IsArray()
  leadIds!: string[];
}

class UpdateStatusDto {
  @IsIn(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'])
  status!: CampaignStatus;
}

@Controller('campaigns')
export class CampaignsController {
  constructor(private campaigns: CampaignsService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(user.id, dto.name, dto.icpProfileId, dto.steps);
  }

  @Get()
  list(@CurrentUser() user: any) {
    return this.campaigns.list(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.campaigns.findOne(user.id, id);
  }

  @Patch(':id/status')
  setStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.campaigns.setStatus(user.id, id, dto.status);
  }

  @Post(':id/enroll')
  enroll(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: EnrollDto) {
    return this.campaigns.enroll(user.id, id, dto.leadIds);
  }
}
