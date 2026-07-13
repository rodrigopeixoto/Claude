import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { BulkImportLeadsDto, CreateLeadDto, ImportPostsDto, ScrapePostsDto } from './dto/lead.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@ApiTags('leads')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create or update a single lead' })
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Import multiple leads at once, e.g. from search results' })
  bulkImport(@Body() dto: BulkImportLeadsDto) {
    return this.leads.bulkImport(dto.leads);
  }

  @Get()
  @ApiOperation({ summary: 'List all leads' })
  findAll() {
    return this.leads.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead details, including posts and outreach history' })
  findOne(@Param('id') id: string) {
    return this.leads.findOne(id);
  }

  @Post(':id/posts/scrape')
  @ApiOperation({ summary: "Start scraping this lead's recent LinkedIn posts via Apify" })
  scrapePosts(@Param('id') id: string, @Body() dto: ScrapePostsDto) {
    return this.leads.scrapePosts(id, dto.maxPosts);
  }

  @Post(':id/posts/import')
  @ApiOperation({ summary: 'Import scraped posts from a finished Apify run into this lead' })
  importPosts(@Param('id') id: string, @Body() dto: ImportPostsDto) {
    return this.leads.importPosts(id, dto.runId);
  }
}
