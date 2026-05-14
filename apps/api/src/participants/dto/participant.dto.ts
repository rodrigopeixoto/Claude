import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddParticipantDto {
  @ApiProperty({ example: 'bob@company.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Bob Johnson' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
