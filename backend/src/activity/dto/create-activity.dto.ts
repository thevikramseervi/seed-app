import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateActivityDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  userType?: string;

  @IsString()
  @IsNotEmpty()
  project!: string;

  @IsString()
  @IsNotEmpty()
  task!: string;

  @IsOptional()
  @IsString()
  subTask?: string;

  @IsString()
  @IsNotEmpty()
  unit!: string;

  @IsInt()
  @Min(0)
  nos!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage!: number;

  @IsNumber()
  @Min(0)
  productivity!: number;

  @IsNumber()
  weightage!: number;
}

