import {
  IsString, IsDateString, IsInt, Min, Max, IsOptional,
  IsIn, MinLength, MaxLength, Matches
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';

export class CreateMeetingDto {
  @ApiProperty({ example: 'Product Sync' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Weekly product alignment meeting' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 60, description: 'Duration in minutes' })
  @IsInt()
  @Min(15)
  @Max(480)
  durationMin: number;

  @ApiProperty({ example: '2026-05-20' })
  @IsDateString()
  dateRangeStart: string;

  @ApiProperty({ example: '2026-05-27' })
  @IsDateString()
  dateRangeEnd: string;

  @ApiProperty({ example: '09:00', description: 'HH:MM 24h format' })
  @Matches(/^\d{2}:\d{2}$/)
  timeWindowStart: string;

  @ApiProperty({ example: '18:00', description: 'HH:MM 24h format' })
  @Matches(/^\d{2}:\d{2}$/)
  timeWindowEnd: string;

  @ApiProperty({ example: 'America/Sao_Paulo' })
  @IsString()
  timezone: string;
}

export class UpdateMeetingDto extends PartialType(OmitType(CreateMeetingDto, [] as const)) {}

export class ConfirmSlotDto {
  @ApiProperty({ example: '2026-05-21T14:00:00Z' })
  @IsDateString()
  slotStart: string;
}
