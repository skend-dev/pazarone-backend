import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyPaymentMethodDto {
  @ApiPropertyOptional({
    description: 'Verification notes (optional)',
    example: 'Payment method verified successfully',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

