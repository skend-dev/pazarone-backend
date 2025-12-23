import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiProperty({ description: 'Current password', example: 'current-password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: 'New password (minimum 6 characters)', example: 'new-password', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;

  @ApiProperty({ description: 'Confirm new password', example: 'new-password' })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}

