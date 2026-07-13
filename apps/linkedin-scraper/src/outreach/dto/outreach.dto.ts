import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const TYPES = ['connection_request', 'message'];
const MANUAL_STATUSES = ['accepted', 'replied', 'skipped', 'withdrawn'];

export class CreateDraftDto {
  @ApiProperty()
  @IsString()
  leadId: string;

  @ApiProperty({ enum: TYPES })
  @IsIn(TYPES)
  type: string;

  @ApiProperty({ description: 'Message text — write and review it yourself before queueing' })
  @IsString()
  @MinLength(1)
  draftText: string;
}

export class GenerateDraftDto {
  @ApiProperty()
  @IsString()
  leadId: string;

  @ApiProperty({ enum: TYPES })
  @IsIn(TYPES)
  type: string;

  @ApiProperty({
    description:
      'Template with placeholders {{firstName}}, {{fullName}}, {{company}}, {{headline}}, {{post}} (latest scraped post text, if any)',
    example: 'Oi {{firstName}}, vi seu post sobre "{{post}}" e queria trocar uma ideia sobre {{headline}}.',
  })
  @IsString()
  template: string;

  @ApiPropertyOptional({ description: 'Specific post ID to use for {{post}}; defaults to the most recent one' })
  @IsOptional()
  @IsString()
  postId?: string;
}

export class UpdateDraftDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  draftText: string;
}

export class MarkStatusDto {
  @ApiProperty({ enum: MANUAL_STATUSES })
  @IsIn(MANUAL_STATUSES)
  status: string;
}
