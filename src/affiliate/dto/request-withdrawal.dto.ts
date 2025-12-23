import { IsNumber, IsPositive, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestWithdrawalDto {
  @ApiProperty({
    description: 'Withdrawal amount in den',
    example: 1500,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({
    description: 'Payment method (e.g., bank_transfer, paypal)',
    example: 'bank_transfer',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Payment account details (JSON string or plain text)',
    example: 'Account: 123456789, Bank: Example Bank',
  })
  @IsOptional()
  @IsString()
  paymentDetails?: string;
}

