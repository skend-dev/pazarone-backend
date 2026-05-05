import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { normalizeMarketingGenderInput } from '../utils/marketing-gender';

const SOURCES = ['registered', 'import', 'manual', 'infobip'] as const;

export type MarketingContactSourceQuery = (typeof SOURCES)[number];

const USER_TYPES = ['seller', 'affiliate', 'customer', 'admin'] as const;

const CONTACT_CHANNEL = ['email', 'phone'] as const;

const GENDER_FILTER = ['male', 'female'] as const;

export class ListMarketingContactsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description:
      'Search email, phone (E.164 or raw digits), name, gender (male/female), city, address, market, tag',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: SOURCES })
  @IsOptional()
  @IsIn(SOURCES)
  source?: MarketingContactSourceQuery;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  emailMarketingOptIn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  viberMarketingOptIn?: string;

  @ApiPropertyOptional({ enum: USER_TYPES })
  @IsOptional()
  @IsIn(USER_TYPES)
  userType?: (typeof USER_TYPES)[number];

  /** Filter rows linked to an app account */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  hasUser?: string;

  @ApiPropertyOptional({ description: 'Exact match on synced market code' })
  @IsOptional()
  @IsString()
  market?: string;

  @ApiPropertyOptional({ enum: GENDER_FILTER })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return undefined;
    return normalizeMarketingGenderInput(value) ?? undefined;
  })
  @IsIn(GENDER_FILTER)
  gender?: (typeof GENDER_FILTER)[number];

  @ApiPropertyOptional({ description: 'ILIKE substring on city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'ILIKE substring on tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description:
      'Filter to rows with a non-empty email (email) or phone (phone)',
    enum: CONTACT_CHANNEL,
  })
  @IsOptional()
  @IsIn(CONTACT_CHANNEL)
  contactChannel?: (typeof CONTACT_CHANNEL)[number];
}
