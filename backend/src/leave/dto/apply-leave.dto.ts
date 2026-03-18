import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { LeaveType } from '@prisma/client';

export class ApplyLeaveDto {
  @ApiProperty({ enum: LeaveType, example: LeaveType.CASUAL_LEAVE })
  @IsEnum(LeaveType)
  @IsNotEmpty()
  leaveType: LeaveType;

  @ApiProperty({ example: '2026-02-20' })
  @IsDateString()
  @IsNotEmpty()
  fromDate: string;

  @ApiProperty({ example: '2026-02-22' })
  @IsDateString()
  @IsNotEmpty()
  toDate: string;

  @ApiProperty({ example: 'Family function' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
