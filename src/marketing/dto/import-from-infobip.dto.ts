import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class ImportFromInfobipDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 500,
    default: 50,
    description: 'Page size for Infobip People LIST request.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;

  @ApiPropertyOptional({
    description:
      'Max pages guard (pagination safety). Covers ~955 with pageSize≈50 in ~19 pages.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  maxPages?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'If true and import creates/updates rows without linked user accounts: set Viber opt-in.',
  })
  @IsOptional()
  @IsBoolean()
  assumeViberOptIn?: boolean;
}
