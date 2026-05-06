import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { MarketingCanonicalGender } from '../utils/marketing-gender';
import { MARKETING_CANONICAL_GENDERS } from '../utils/marketing-gender';

export class CreateMarketingContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Raw or E.164; stored normalized when valid (MK default region when needed)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  name?: string;

  @ApiPropertyOptional({ enum: MARKETING_CANONICAL_GENDERS })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsIn(MARKETING_CANONICAL_GENDERS)
  gender?: MarketingCanonicalGender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;

  @ApiPropertyOptional({ maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  market?: string;

  @ApiPropertyOptional({
    description: 'Optional segment or campaign tag',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  tag?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  emailMarketingOptIn?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  viberMarketingOptIn?: boolean;
}
