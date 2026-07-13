import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsObject, IsOptional, IsString, IsUrl, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLeadDto {
  @ApiProperty({ example: 'https://www.linkedin.com/in/exemplo/' })
  @IsUrl()
  linkedinUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Full scraped profile payload, stored for reference' })
  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown>;
}

export class BulkImportLeadsDto {
  @ApiProperty({ type: [CreateLeadDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLeadDto)
  leads: CreateLeadDto[];
}

export class ScrapePostsDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPosts?: number;
}

export class ImportPostsDto {
  @ApiProperty({ description: 'Apify run ID returned by the posts-scrape endpoint, once SUCCEEDED' })
  @IsString()
  runId: string;
}
