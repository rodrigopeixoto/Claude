import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsIn, IsObject, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class ScrapeProfilesDto {
  @ApiProperty({
    example: ['https://www.linkedin.com/in/example-profile/'],
    description: 'LinkedIn profile URLs to scrape',
  })
  @IsArray()
  @IsUrl({}, { each: true })
  urls: string[];

  @ApiPropertyOptional({ description: 'Overrides APIFY_LINKEDIN_ACTOR_ID for this request' })
  @IsOptional()
  @IsString()
  actorId?: string;
}

const SENIORITY_LEVEL_IDS = ['100', '110', '120', '130', '200', '210', '220', '300', '310', '320'];
const PROFILE_LANGUAGES = [
  'Arabic', 'English', 'Spanish', 'Portuguese', 'Chinese', 'French', 'Italian', 'Russian',
  'German', 'Dutch', 'Turkish', 'Tagalog', 'Polish', 'Korean', 'Japanese', 'Malay',
  'Norwegian', 'Danish', 'Romanian', 'Swedish', 'Bahasa Indonesia', 'Czech',
];
const COMPANY_HEADCOUNTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const PROFILE_SCRAPER_MODES = ['Short', 'Full', 'Full + email search'];

export class SearchProfilesDto {
  @ApiPropertyOptional({ example: 'Product Designer', description: 'Free-text fuzzy search query' })
  @IsOptional()
  @IsString()
  searchQuery?: string;

  @ApiPropertyOptional({ example: ['São Paulo, Brazil'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @ApiPropertyOptional({ description: 'Full LinkedIn company URLs', example: ['https://www.linkedin.com/company/google/'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentCompanies?: string[];

  @ApiPropertyOptional({ description: 'Full LinkedIn company URLs', example: ['https://www.linkedin.com/company/microsoft/'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pastCompanies?: string[];

  @ApiPropertyOptional({ example: ['Universidade de São Paulo'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  schools?: string[];

  @ApiPropertyOptional({ example: ['Software Engineer'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentJobTitles?: string[];

  @ApiPropertyOptional({ example: ['Product Manager'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pastJobTitles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  firstNames?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lastNames?: string[];

  @ApiPropertyOptional({
    description: 'LinkedIn industry IDs (numeric codes, not names) — see the harvestapi/linkedin-industry-codes-v2 reference on GitHub',
    example: ['4'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industryIds?: string[];

  @ApiPropertyOptional({ enum: SENIORITY_LEVEL_IDS })
  @IsOptional()
  @IsArray()
  @IsIn(SENIORITY_LEVEL_IDS, { each: true })
  seniorityLevelIds?: string[];

  @ApiPropertyOptional({ enum: PROFILE_LANGUAGES })
  @IsOptional()
  @IsArray()
  @IsIn(PROFILE_LANGUAGES, { each: true })
  profileLanguages?: string[];

  @ApiPropertyOptional({ enum: COMPANY_HEADCOUNTS, description: 'A=Self-employed, B=1-10, ... I=10,001+' })
  @IsOptional()
  @IsArray()
  @IsIn(COMPANY_HEADCOUNTS, { each: true })
  companyHeadcount?: string[];

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxItems?: number;

  @ApiPropertyOptional({ enum: PROFILE_SCRAPER_MODES, default: 'Full' })
  @IsOptional()
  @IsIn(PROFILE_SCRAPER_MODES)
  profileScraperMode?: string;

  @ApiPropertyOptional({ description: 'Overrides APIFY_SEARCH_ACTOR_ID for this request' })
  @IsOptional()
  @IsString()
  actorId?: string;
}

export class RunActorDto {
  @ApiProperty({ example: 'apify/some-linkedin-actor' })
  @IsString()
  actorId: string;

  @ApiProperty({
    description: 'Raw input passed through to the Apify actor, matching its own input schema',
    example: { profileUrls: ['https://www.linkedin.com/in/example-profile/'] },
  })
  @IsObject()
  input: Record<string, unknown>;
}
