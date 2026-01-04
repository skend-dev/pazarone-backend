import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Customer name',
    example: 'John Doe',
  })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description:
      'Phone number (minimum 5 characters, allows digits, spaces, +, -, (, ))',
    example: '+1 (234) 567-8900',
    minLength: 5,
  })
  @IsString()
  @IsOptional()
  @MinLength(5, {
    message: 'phone must be longer than or equal to 5 characters',
  })
  @Matches(/^[\d\s\+\-\(\)]+$/, {
    message: 'phone must match /^[\\d\\s\\+\\-\\(\\)]+$/ regular expression',
  })
  phone?: string;
}

