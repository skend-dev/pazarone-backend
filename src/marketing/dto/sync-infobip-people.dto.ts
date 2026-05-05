import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SyncMarketingContactsInfobipDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 500,
    default: 100,
    description:
      'Contacts **with phone** to upsert into Infobip People (`INFOBIP_PEOPLE_SYNC_ENABLED=true`; most recently updated first).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
