import { IsString, IsEnum, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarProvider } from '@prisma/client';

export class CreateOAuthConfigDto {
  @ApiProperty({ enum: CalendarProvider, example: 'GOOGLE' })
  @IsEnum(CalendarProvider)
  provider: CalendarProvider;

  @ApiProperty({ example: 'Conta Google Workspace' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label: string;

  @ApiProperty({ example: '123456789-abc.apps.googleusercontent.com' })
  @IsString()
  @MinLength(10)
  clientId: string;

  @ApiProperty({ example: 'GOCSPX-...' })
  @IsString()
  @MinLength(10)
  clientSecret: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
