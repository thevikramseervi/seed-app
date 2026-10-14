import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMyAssetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;
}
