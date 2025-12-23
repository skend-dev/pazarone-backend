import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSellerPlatformFeeDto {
  @ApiPropertyOptional({
    description:
      'Platform fee percentage for this seller. Set to null to use platform default.',
    example: 7.5,
    minimum: 0,
    maximum: 100,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  platformFeePercent?: number | null;
}
