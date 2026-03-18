import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, IsEnum, IsOptional } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class UpdateAttendanceDto {
  @ApiProperty({ enum: AttendanceStatus, required: false })
  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

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
