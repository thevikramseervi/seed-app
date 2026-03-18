import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional, IsNumber, IsDateString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'CITSEED100' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsNotEmpty()
  employeeNumber: number;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john.doe@cambridge.edu.in' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'Annotator', required: false })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiProperty({ enum: Role, example: Role.EMPLOYEE })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  @IsNotEmpty()
  dateOfJoining: string;

  @ApiProperty({ example: 22000, required: false })
  @IsNumber()
  @IsOptional()
  baseSalary?: number;
}
