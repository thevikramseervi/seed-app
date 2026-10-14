import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetType } from '@prisma/client';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  assetName?: string;

  @IsOptional()
  @IsEnum(AssetType)
  assetType?: AssetType;

  @IsOptional()
  @IsString()
  assetNumber?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  userId?: string | null;
}
