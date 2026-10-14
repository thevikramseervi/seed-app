import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AssetType } from '@prisma/client';

export class CreateAssetDto {
  @IsNotEmpty()
  @IsString()
  assetName: string;

  @IsEnum(AssetType)
  assetType: AssetType;

  @IsNotEmpty()
  @IsString()
  assetNumber: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
