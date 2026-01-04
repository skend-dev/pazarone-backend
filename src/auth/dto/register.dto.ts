import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserType } from '../../users/entities/user.entity';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description: 'User password (minimum 6 characters)',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'User type',
    enum: UserType,
    example: UserType.SELLER,
  })
  @IsEnum(UserType)
  @IsNotEmpty()
  userType: UserType;

  @ApiPropertyOptional({
    description: 'Market location (required for sellers) - "MK" for North Macedonia, "KS" for Kosovo',
    example: 'MK',
    enum: ['MK', 'KS'],
  })
  @IsString()
  @IsOptional()
  market?: string;

  @ApiPropertyOptional({
    description:
      'Verification token from email verification (optional - required if email is not already verified)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsOptional()
  verificationToken?: string;
}

