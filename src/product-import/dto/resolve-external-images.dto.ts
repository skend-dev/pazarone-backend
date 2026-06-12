import { IsArray, IsEnum, IsOptional, IsString, IsUrl, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ResolveExternalImageAction {
  REPLACE_IMAGES = 'replace_images',
  KEEP_DEACTIVATED = 'keep_deactivated',
  DISMISS = 'dismiss',
}

export class ResolveExternalImagesDto {
  @ApiProperty({ enum: ResolveExternalImageAction })
  @IsEnum(ResolveExternalImageAction)
  action: ResolveExternalImageAction;

  @ApiPropertyOptional({ type: [String], description: 'New Cloudinary URLs when action is replace_images' })
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}
