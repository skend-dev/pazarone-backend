import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SyncMarketingContactsInfobipDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 500,
    default: 100,
    description:
      'Max contacts to push in this batch. Only **unsynced** contacts are selected ' +
      '(those where `infobipPeopleSyncedAt IS NULL`) unless `forceResync=true`.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'When `true`, re-push contacts that were already synced (ignores `infobipPeopleSyncedAt`). ' +
      'Use to reconcile or refresh existing Infobip profiles.',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  forceResync?: boolean;
}
