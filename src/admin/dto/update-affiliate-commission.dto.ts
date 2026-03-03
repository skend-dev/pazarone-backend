import {
  IsNumber,
  Min,
  Max,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateAffiliateCommissionDto {
  @ApiPropertyOptional({
    description: 'Override for buyer referral commission % (product purchases). Null = use product.affiliateCommission',
  })
  @IsOptional()
  @ValidateIf((o) => o.buyerCommissionPercent != null)
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  buyerCommissionPercent?: number | null;

  @ApiPropertyOptional({
    description: 'Commission % of platform fee for referred sellers (ambassadors). Null = not an ambassador for seller referral',
  })
  @IsOptional()
  @ValidateIf((o) => o.sellerReferralCommissionPercent != null)
  @IsNumber()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  sellerReferralCommissionPercent?: number | null;

  @ApiPropertyOptional({
    description: 'Min withdrawal threshold for this ambassador. Null = use platform default',
  })
  @IsOptional()
  @ValidateIf((o) => o.minWithdrawalThreshold != null)
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minWithdrawalThreshold?: number | null;
}
