import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterCustomerDto {
  @ApiProperty({
    description: 'Email address (must be verified)',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Customer name',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Password',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiPropertyOptional({
    description:
      'Verification token from email verification (optional if email is already verified)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsOptional()
  verificationToken?: string;

  @ApiPropertyOptional({
    description:
      'Verification code (6-digit code) - alternative to verificationToken. If provided, will be verified first.',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsOptional()
  @Length(6, 6, { message: 'Verification code must be 6 digits' })
  verificationCode?: string;
}
