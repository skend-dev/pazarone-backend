import { IsBoolean, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MarkPaymentSettledDto {
  @ApiProperty({
    description: 'Array of order IDs to mark as settled',
    example: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds: string[];

  @ApiPropertyOptional({
    description: 'Optional notes about the payment settlement',
    example: 'Payment processed via bank transfer on 2024-01-15',
  })
  @IsOptional()
  notes?: string;
}

