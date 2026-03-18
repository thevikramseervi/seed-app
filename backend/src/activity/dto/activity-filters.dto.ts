import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class ActivityFiltersDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  project?: string;
}

