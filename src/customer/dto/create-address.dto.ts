import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiProperty({
    description: 'Street address (minimum 5 characters)',
    example: '123 Main St',
    minLength: 5,
  })
  @IsString()
  @IsNotEmpty({ message: 'street should not be empty' })
  @MinLength(5, { message: 'street must be at least 5 characters' })
  street: string;

  @ApiProperty({
    description: 'City (minimum 2 characters)',
    example: 'New York',
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty({ message: 'city should not be empty' })
  @MinLength(2, {
    message: 'city must be longer than or equal to 2 characters',
  })
  city: string;

  @ApiProperty({
    description: 'State/Province (minimum 2 characters)',
    example: 'NY',
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty({ message: 'state should not be empty' })
  @MinLength(2, {
    message: 'state must be longer than or equal to 2 characters',
  })
  state: string;

  @ApiProperty({
    description: 'ZIP/Postal code (minimum 3 characters)',
    example: '10001',
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty({ message: 'zip should not be empty' })
  @MinLength(3, { message: 'zip must be longer than or equal to 3 characters' })
  zip: string;

  @ApiProperty({ description: 'Country', example: 'United States' })
  @IsString()
  @IsNotEmpty({ message: 'country should not be empty' })
  country: string;

  @ApiProperty({
    description:
      'Phone number (minimum 5 characters, allows digits, spaces, +, -, (, ))',
    example: '+1 (234) 567-8900',
    minLength: 5,
  })
  @IsString()
  @IsNotEmpty({ message: 'phone should not be empty' })
  @MinLength(5, {
    message: 'phone must be longer than or equal to 5 characters',
  })
  @Matches(/^[\d\s\+\-\(\)]+$/, {
    message: 'phone must match /^[\\d\\s\\+\\-\\(\\)]+$/ regular expression',
  })
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
