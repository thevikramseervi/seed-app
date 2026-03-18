import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateHolidayDto {
  @ApiProperty({ example: '2026-01-26' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: 'Republic Day' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'National Holiday', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;
}
