import { IsOptional, IsString, IsInt, Min, IsUUID, IsBoolean, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PublicProductQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ 
    description: 'Search term (searches in product name)', 
    example: 'headphones' 
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ 
    description: 'Category ID (UUID) to filter products', 
    example: '123e4567-e89b-12d3-a456-426614174000' 
  })
  @IsOptional()
  @IsUUID()
  category?: string;

  @ApiPropertyOptional({ 
    description: 'Seller ID (UUID) to filter products by seller', 
    example: '123e4567-e89b-12d3-a456-426614174000' 
  })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({
    description:
      'Sort order (trending/popular = by popularity; sales = by sales count; commission_asc/desc = by affiliate commission)',
    enum: [
      'trending',
      'popular',
      'sales',
      'newest',
      'oldest',
      'price_asc',
      'price_desc',
      'name_asc',
      'name_desc',
      'commission_asc',
      'commission_desc',
    ],
    example: 'trending',
  })
  @IsOptional()
  @IsString()
  sortBy?:
    | 'trending'
    | 'popular'
    | 'sales'
    | 'newest'
    | 'oldest'
    | 'price_asc'
    | 'price_desc'
    | 'name_asc'
    | 'name_desc'
    | 'commission_asc'
    | 'commission_desc' = 'trending';

  @ApiPropertyOptional({ 
    description: 'Filter products on sale (true = only products with active sale price, false = only products without sale)', 
    example: true
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onSale?: boolean;

  @ApiPropertyOptional({ description: 'Minimum price (effective price: sale or regular)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price (effective price: sale or regular)', example: 20000 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Minimum rating (1-5)', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Only products in stock (stock > 0)', example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ 
    description: 'Category IDs comma-separated (products in any of these categories or their subcategories)', 
    example: 'uuid1,uuid2' 
  })
  @IsOptional()
  @IsString()
  categories?: string;

  @ApiPropertyOptional({
    description: 'Minimum affiliate commission percentage (for affiliate product listing). Only products with affiliateCommission >= this value are returned.',
    example: 5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  minCommission?: number;

  @ApiPropertyOptional({
    description: 'Maximum affiliate commission percentage. Only products with affiliateCommission <= this value are returned. Ignored if less than minCommission.',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  maxCommission?: number;
}

