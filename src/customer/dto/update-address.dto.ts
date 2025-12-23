import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAddressDto {
  @ApiPropertyOptional({ description: 'Street address', example: '123 Main St' })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  street?: string;

  @ApiPropertyOptional({ description: 'City', example: 'New York' })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  city?: string;

  @ApiPropertyOptional({ description: 'State/Province', example: 'NY' })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  state?: string;

  @ApiPropertyOptional({ description: 'ZIP/Postal code', example: '10001' })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  zip?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'United States' })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  country?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+1234567890' })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Set as default address',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

