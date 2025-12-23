import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
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

  @ApiProperty({ description: 'Country', example: 'United States' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ description: 'Phone number', example: '+1234567890' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    description: 'Set as default address',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

