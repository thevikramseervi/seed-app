import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateHolidayDto {
  @ApiProperty({ example: '2026-01-26', required: false })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiProperty({ example: 'Republic Day', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'National Holiday', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;
}
