import { IsEmail, IsString, IsEnum, IsOptional, MinLength, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserType } from '../../users/entities/user.entity';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'password123', minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ enum: UserType, example: UserType.SELLER })
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @ApiPropertyOptional({
    description: 'Market location - "MK" for North Macedonia, "KS" for Kosovo',
    example: 'MK',
    enum: ['MK', 'KS'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['MK', 'KS'])
  market?: string;

  @ApiPropertyOptional({ example: 7.0, description: 'Platform fee percentage (ignored - not a user property)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  platformFeePercent?: number;
}

