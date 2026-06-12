import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum DuplicateImportMode {
  SKIP = 'skip',
  UPDATE = 'update',
}

export class CategoryMappingEntryDto {
  @IsOptional()
  sourceLabel?: string;

  @IsUUID()
  categoryId: string;
}

export class ProductImportOptionsDto {
  @ApiPropertyOptional({ enum: DuplicateImportMode, default: DuplicateImportMode.SKIP })
  @IsEnum(DuplicateImportMode)
  @IsOptional()
  duplicateMode?: DuplicateImportMode = DuplicateImportMode.SKIP;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  defaultCategoryId?: string;

  @ApiPropertyOptional({
    description: 'Map source category labels to Pazarone category IDs',
    type: 'object',
    additionalProperties: { type: 'string', format: 'uuid' },
  })
  @IsObject()
  @IsOptional()
  categoryMappings?: Record<string, string>;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  defaultAffiliateCommission?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  importUnpublished?: boolean = false;
}
