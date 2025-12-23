import { IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAccountDto {
  @ApiPropertyOptional({ description: 'Email address', example: 'newemail@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+1 (555) 999-8888' })
  @IsString()
  @IsOptional()
  phone?: string;
}

