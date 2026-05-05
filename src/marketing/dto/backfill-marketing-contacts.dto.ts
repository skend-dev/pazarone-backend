import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class BackfillMarketingContactsDto {
  @ApiPropertyOptional({
    description: 'If true, counts users without writing marketing_contacts rows',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
