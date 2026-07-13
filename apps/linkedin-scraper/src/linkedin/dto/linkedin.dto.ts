import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString, IsUrl } from 'class-validator';

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
