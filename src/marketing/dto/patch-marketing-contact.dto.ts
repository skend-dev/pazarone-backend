import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { MARKETING_CANONICAL_GENDERS } from '../utils/marketing-gender';

export class PatchMarketingContactDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Lowercased email; omit or send null to clear',
  })
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Raw or E.164; null or empty clears phone',
  })
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Market code (e.g. MK)',
  })
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(10)
  market?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Segment or campaign tag; null clears',
  })
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(128)
  tag?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Full name' })
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(512)
  name?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: MARKETING_CANONICAL_GENDERS,
    description: 'male or female; null clears',
  })
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsIn(MARKETING_CANONICAL_GENDERS)
  gender?: (typeof MARKETING_CANONICAL_GENDERS)[number] | null;

  @ApiPropertyOptional({ nullable: true })
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(256)
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MaxLength(2000)
  address?: string | null;

  @ApiPropertyOptional({
    description: 'Email marketing consent (manual override by admin)',
  })
  @IsOptional()
  @IsBoolean()
  emailMarketingOptIn?: boolean;

  @ApiPropertyOptional({
    description: 'Viber marketing consent (explicit opt-in for messaging)',
  })
  @IsOptional()
  @IsBoolean()
  viberMarketingOptIn?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Hard stop timestamp for email; null clears suppression',
  })
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string')
  @IsDateString()
  emailSuppressedAt?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Hard stop timestamp for Viber; null clears suppression',
  })
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string')
  @IsDateString()
  viberSuppressedAt?: string | null;
}
