import { IsNumber, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({
    description: 'Minimum withdrawal threshold for affiliates (in den)',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  affiliateMinWithdrawalThreshold?: number;

  @ApiPropertyOptional({
    description: 'Platform fee percentage',
    example: 7.0,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  platformFeePercent?: number;
}

