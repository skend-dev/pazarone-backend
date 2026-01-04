import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectPaymentMethodDto {
  @ApiProperty({
    description: 'Rejection reason (required)',
    example: 'Invalid account number format',
  })
  @IsString()
  @IsNotEmpty()
  notes: string;
}

