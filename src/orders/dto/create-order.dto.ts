import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateNested,
  Min,
  IsInt,
  IsObject,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class OrderItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({
    description: 'Product Variant ID (required if product has variants)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @ApiProperty({ description: 'Quantity', example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

class ShippingAddressDto {
  @ApiProperty({ description: 'Street address', example: '123 Main St' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ description: 'City', example: 'New York' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State/Province', example: 'NY' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'ZIP/Postal code', example: '10001' })
  @IsString()
  @IsNotEmpty()
  zip: string;

  @ApiProperty({
    description: 'Country (must be supported by seller)',
    example: 'North Macedonia',
  })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ description: 'Phone number', example: '+1234567890' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

class CustomerInfoDto {
  @ApiProperty({ description: 'Customer name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Customer email', example: 'john@example.com' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Customer phone', example: '+1234567890' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'Order items (can contain products from multiple sellers)',
    type: [OrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @IsNotEmpty()
  items: OrderItemDto[];

  @ApiProperty({
    description: 'Shipping address',
    type: ShippingAddressDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  @IsNotEmpty()
  shippingAddress: ShippingAddressDto;

  @ApiProperty({
    description: 'Customer information (required for guest orders)',
    type: CustomerInfoDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  @IsNotEmpty()
  customer: CustomerInfoDto;

  @ApiPropertyOptional({
    description:
      'Customer ID (UUID) - optional, if provided will use authenticated user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Tracking ID (optional, can be added later)',
    example: 'TRK-789456123',
  })
  @IsString()
  @IsOptional()
  trackingId?: string;

  @ApiPropertyOptional({
    description: 'Referral code from affiliate (optional)',
    example: 'AFF-ABC123',
  })
  @IsString()
  @IsOptional()
  referralCode?: string;

  @ApiPropertyOptional({
    description:
      'Affiliate ID (UUID) - optional, can be derived from referralCode',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  affiliateId?: string;

  @ApiPropertyOptional({
    description:
      'Email verification token (required for guest orders, optional for authenticated users)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsOptional()
  verificationToken?: string;
}
