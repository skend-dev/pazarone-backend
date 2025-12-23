import { IsOptional, IsString, IsInt, Min, IsUUID } from 'class-validator';
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
    description: 'Sort order', 
    enum: ['newest', 'oldest', 'price_asc', 'price_desc', 'name_asc', 'name_desc'],
    example: 'newest'
  })
  @IsOptional()
  @IsString()
  sortBy?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' = 'newest';
}

