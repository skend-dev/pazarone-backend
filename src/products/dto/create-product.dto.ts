import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CreateVariantAttributeDto,
  CreateProductVariantDto,
} from './create-product-variant.dto';

export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Premium Wireless Headphones',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Product description',
    example: 'High-quality wireless headphones with noise cancellation',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description: 'Category ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Category name (legacy field, use categoryId instead)',
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Product price', example: 149.99, minimum: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Stock quantity', example: 45, minimum: 0 })
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiPropertyOptional({
    description: 'SKU (Stock Keeping Unit)',
    example: 'PWH-001',
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({
    description:
      'Product images (array of Cloudinary URLs). Upload images first using POST /api/upload/images endpoint. Minimum 1, maximum 8 images required.',
    type: [String],
    example: [
      'https://res.cloudinary.com/.../image1.jpg',
      'https://res.cloudinary.com/.../image2.jpg',
    ],
    minItems: 1,
    maxItems: 8,
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  @ArrayMinSize(1, { message: 'At least 1 image is required' })
  @ArrayMaxSize(8, { message: 'Maximum 8 images allowed' })
  images: string[];

  @ApiPropertyOptional({
    description: 'Product details/specifications',
    example: 'Product specifications and features...',
  })
  @IsString()
  @IsOptional()
  details?: string;

  @ApiPropertyOptional({
    description: 'Affiliate commission percentage',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  affiliateCommission?: number;

  @ApiPropertyOptional({
    description: 'Variant attributes (e.g., Size, Color) - required if variants are provided',
    type: [CreateVariantAttributeDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantAttributeDto)
  @IsOptional()
  variantAttributes?: CreateVariantAttributeDto[];

  @ApiPropertyOptional({
    description: 'Product variants (combinations of attribute values) - required if variantAttributes are provided',
    type: [CreateProductVariantDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  @IsOptional()
  variants?: CreateProductVariantDto[];
}
