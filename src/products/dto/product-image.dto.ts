import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductImageDto {
  @ApiProperty({
    description: 'Cloudinary image URL',
    example: 'https://res.cloudinary.com/cloud/image/upload/v123/pazarone/products/image.jpg',
  })
  @IsUrl({}, { message: 'url must be a valid URL' })
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    description: 'Cloudinary public ID',
    example: 'pazarone/products/image',
  })
  @IsString()
  @IsNotEmpty({ message: 'publicId is required' })
  publicId: string;

  @ApiPropertyOptional({
    description: 'Image width in pixels',
    example: 1920,
  })
  @IsNumber()
  @IsOptional()
  width?: number;

  @ApiPropertyOptional({
    description: 'Image height in pixels',
    example: 1080,
  })
  @IsNumber()
  @IsOptional()
  height?: number;

  @ApiPropertyOptional({
    description: 'Image file size in bytes',
    example: 245760,
  })
  @IsNumber()
  @IsOptional()
  bytes?: number;

  @ApiPropertyOptional({
    description: 'Image format (e.g., jpg, png, webp)',
    example: 'webp',
  })
  @IsString()
  @IsOptional()
  format?: string;
}
