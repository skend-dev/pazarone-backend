import {
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PromoteToAmbassadorDto {
  @ApiProperty({
    description: 'Commission % of platform fee for referred sellers (Option B)',
    example: 30,
    minimum: 0,
    maximum: 50,
  })
  @IsNumber()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  sellerReferralCommissionPercent: number;

  @ApiPropertyOptional({
    description: 'Override for buyer referral commission % (product purchases)',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  buyerCommissionPercent?: number;

  @ApiPropertyOptional({
    description: 'Min withdrawal threshold for this ambassador (overrides platform default). Set to null to use platform default.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minWithdrawalThreshold?: number | null;
}
