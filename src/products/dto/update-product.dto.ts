import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ArrayMinSize(1, { message: 'At least 1 image is required' })
  @ArrayMaxSize(8, { message: 'Maximum 8 images allowed' })
  images?: string[];

  @IsString()
  @IsOptional()
  details?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  affiliateCommission?: number;
}
