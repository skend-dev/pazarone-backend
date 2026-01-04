import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsObject,
  IsBoolean,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVariantValueDto {
  @ApiProperty({
    description: 'Variant value (e.g., "XL", "Red", "Cotton")',
    example: 'XL',
  })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({
    description: 'Hex color code for color attributes (e.g., "#FF0000")',
    example: '#FF0000',
  })
  @IsString()
  @IsOptional()
  colorCode?: string;

  @ApiPropertyOptional({
    description: 'Display order for this value',
    example: 0,
  })
  @IsNumber()
  @IsOptional()
  displayOrder?: number;
}

export class CreateVariantAttributeDto {
  @ApiProperty({
    description: 'Attribute name (e.g., "Size", "Color", "Material")',
    example: 'Size',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'List of values for this attribute',
    type: [CreateVariantValueDto],
    example: [
      { value: 'S', displayOrder: 0 },
      { value: 'M', displayOrder: 1 },
      { value: 'L', displayOrder: 2 },
      { value: 'XL', displayOrder: 3 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one value is required for each attribute' })
  @ValidateNested({ each: true })
  @Type(() => CreateVariantValueDto)
  values: CreateVariantValueDto[];

  @ApiPropertyOptional({
    description: 'Display order for this attribute',
    example: 0,
  })
  @IsNumber()
  @IsOptional()
  displayOrder?: number;
}

export class CreateProductVariantDto {
  @ApiProperty({
    description: 'Variant combination (e.g., { "Size": "XL", "Color": "Red" })',
    example: { Size: 'XL', Color: 'Red' },
  })
  @IsObject()
  @IsNotEmpty()
  combination: Record<string, string>;

  @ApiProperty({ description: 'Stock quantity for this variant', example: 10 })
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiPropertyOptional({
    description: 'Price for this variant (if null, uses product base price)',
    example: 149.99,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number | null;

  @ApiPropertyOptional({
    description: 'Variant-specific SKU',
    example: 'TSHIRT-XL-RED',
  })
  @IsString()
  @IsOptional()
  sku?: string | null;

  @ApiPropertyOptional({
    description: 'Variant-specific images (array of Cloudinary URLs)',
    type: [String],
    example: ['https://res.cloudinary.com/.../variant-image.jpg'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[] | null;

  @ApiPropertyOptional({
    description: 'Whether this variant is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

