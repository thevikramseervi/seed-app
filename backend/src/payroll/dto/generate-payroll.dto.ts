import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min, Max, IsOptional, IsString, IsDateString } from 'class-validator';

export class GeneratePayrollDto {
  @ApiProperty({ example: 2026 })
  @IsNumber()
  @Min(2020)
  @Max(2030)
  @IsNotEmpty()
  year: number;

  @ApiProperty({ example: 1, description: 'Month (1-12)' })
  @IsNumber()
  @Min(1)
  @Max(12)
  @IsNotEmpty()
  month: number;

  @ApiProperty({ example: '9da44df2-f325-4ad6-8989-235c480e70cc', required: false })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ example: '2026-01-10', required: false, description: 'Payment date (YYYY-MM-DD). Defaults to the 10th of the following month.' })
  @IsDateString()
  @IsOptional()
  paymentDate?: string;
}
