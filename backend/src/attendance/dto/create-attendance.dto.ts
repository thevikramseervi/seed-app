import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class CreateAttendanceDto {
  @ApiProperty({ example: '9da44df2-f325-4ad6-8989-235c480e70cc' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: '2026-02-06' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ enum: AttendanceStatus, example: AttendanceStatus.PRESENT })
  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status: AttendanceStatus;

  @ApiProperty({ example: '09:00:00', required: false })
  @IsString()
  @IsOptional()
  firstInTime?: string;

  @ApiProperty({ example: '18:00:00', required: false })
  @IsString()
  @IsOptional()
  lastOutTime?: string;

  @ApiProperty({ example: 480, description: 'Duration in minutes', required: false })
  @IsOptional()
  totalDuration?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
