import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
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
}

