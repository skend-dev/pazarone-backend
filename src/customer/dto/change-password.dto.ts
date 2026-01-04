import {
  IsString,
  IsNotEmpty,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'currentPassword123',
  })
  @IsString()
  @IsNotEmpty({ message: 'currentPassword should not be empty' })
  currentPassword: string;

  @ApiProperty({
    description: 'New password (minimum 6 characters)',
    example: 'newPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'newPassword should not be empty' })
  @MinLength(6, { message: 'newPassword must be longer than or equal to 6 characters' })
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password (must match newPassword)',
    example: 'newPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'confirmPassword should not be empty' })
  @MinLength(6, { message: 'confirmPassword must be longer than or equal to 6 characters' })
  confirmPassword: string;
}

