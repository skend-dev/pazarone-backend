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
  IsUrl,
  IsDateString,
  ValidateIf,
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

  @ApiProperty({
    description: 'Product price (legacy field, use regularPrice or salePrice instead)',
    example: 149.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({
    description: 'Regular price of the product',
    example: 149.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  regularPrice?: number;

  @ApiPropertyOptional({
    description: 'Sale/discounted price (if product is on sale)',
    example: 99.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @ApiPropertyOptional({
    description: 'Expiration date/time for the sale price (ISO 8601 format)',
    example: '2026-12-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  salePriceExpiresAt?: string;

  @ApiPropertyOptional({
    description:
      'Stock quantity. Required when the product has no variants; omitted or ignored when variants are provided (summed from variant stock).',
    example: 45,
    minimum: 0,
  })
  @ValidateIf(
    (o: CreateProductDto) => !o.variants || o.variants.length === 0,
  )
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({
    description: 'SKU (Stock Keeping Unit)',
    example: 'PWH-001',
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({
    description:
      'Product images (array of Cloudinary URLs). Upload images directly to Cloudinary using signed uploads (GET /api/cloudinary/sign for signature). Minimum 1, maximum 8 images required.',
    type: [String],
    example: [
      'https://res.cloudinary.com/cloud-name/image/upload/v123/product1.jpg',
      'https://res.cloudinary.com/cloud-name/image/upload/v123/product2.jpg',
    ],
    minItems: 1,
    maxItems: 8,
  })
  @IsArray()
  @IsUrl({}, { each: true, message: 'Each image must be a valid URL' })
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
    description: 'Delivery: "free", "paid" (set prices per country below), or omit for "shipping not included"',
    enum: ['free', 'paid'],
  })
  @IsString()
  @IsOptional()
  shippingType?: 'free' | 'paid';

  @ApiPropertyOptional({
    description: 'Shipping price for North Macedonia (MKD) - only when shippingType is "paid"',
    example: 150,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  shippingPriceNorthMacedonia?: number;

  @ApiPropertyOptional({
    description: 'Shipping price for Kosovo (EUR) - only when shippingType is "paid"',
    example: 5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  shippingPriceKosovo?: number;

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
