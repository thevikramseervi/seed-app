import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsBoolean, IsOptional, IsDateString } from 'class-validator';
import { AnnouncementPriority, TargetAudience } from '@prisma/client';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Office Closed - Republic Day' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Office will remain closed on January 26, 2026 for Republic Day.' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ enum: AnnouncementPriority, example: AnnouncementPriority.HIGH, required: false })
  @IsEnum(AnnouncementPriority)
  @IsOptional()
  priority?: AnnouncementPriority;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @ApiProperty({ enum: TargetAudience, example: TargetAudience.ALL, required: false })
  @IsEnum(TargetAudience)
  @IsOptional()
  targetAudience?: TargetAudience;

  @ApiProperty({ example: '2026-02-28T23:59:59', required: false })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
