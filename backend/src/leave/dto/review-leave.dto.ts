import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

/**
 * DTO used when an admin reviews a leave application.
 * The frontend sends a `comments` field; we persist it as review notes.
 */
export class ReviewLeaveDto {
  @ApiProperty({
    example: 'Approved for the mentioned dates',
    required: false,
    description: 'Optional comments/review notes from the admin',
  })
  @IsString()
  @IsOptional()
  comments?: string;
}
