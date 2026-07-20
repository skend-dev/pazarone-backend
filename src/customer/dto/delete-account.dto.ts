import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiPropertyOptional({
    description:
      'Current account password. Required when the account has a platform password (email sign-up or after set-password).',
    minLength: 1,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  currentPassword?: string;
}
