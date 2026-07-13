import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { LinkedinService } from './linkedin.service';
import { ScrapeProfilesDto, RunActorDto, SearchProfilesDto } from './dto/linkedin.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@ApiTags('linkedin')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('linkedin')
export class LinkedinController {
  constructor(private linkedin: LinkedinService) {}

  @Post('profiles')
  @ApiOperation({ summary: 'Start scraping the given LinkedIn profile URLs via Apify' })
  scrapeProfiles(@Body() dto: ScrapeProfilesDto) {
    return this.linkedin.startProfileScrape(dto.urls, dto.actorId);
  }

  @Post('search')
  @ApiOperation({ summary: 'Start a filtered LinkedIn people search (no login/cookies required)' })
  searchProfiles(@Body() dto: SearchProfilesDto) {
    return this.linkedin.startProfileSearch(dto);
  }

  @Post('run')
  @ApiOperation({ summary: 'Start an arbitrary Apify actor run with a raw input payload' })
  runActor(@Body() dto: RunActorDto) {
    return this.linkedin.startRun(dto.actorId, dto.input);
  }

  @Get('runs/:runId')
  @ApiOperation({ summary: 'Get run status, and dataset items once the run has finished' })
  getRun(@Param('runId') runId: string) {
    return this.linkedin.getRun(runId);
  }
}
