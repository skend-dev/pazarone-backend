import { IsNumber, IsOptional, Min, Max, IsObject, IsString, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class BankTransferDetailsDto {
  @ApiPropertyOptional({
    description: 'Bank name',
    example: 'Komercijalna Banka AD Skopje',
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Bank account number',
    example: '1234567890123',
  })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({
    description: 'Account holder name',
    example: 'PazarOne DOOEL',
  })
  @IsOptional()
  @IsString()
  accountHolder?: string;

  @ApiPropertyOptional({
    description: 'IBAN',
    example: 'MK07250120000058984',
  })
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiPropertyOptional({
    description: 'SWIFT/BIC code',
    example: 'KOBSMK2X',
  })
  @IsOptional()
  @IsString()
  swift?: string;

  @ApiPropertyOptional({
    description: 'Payment reference',
    example: 'INV-{invoiceNumber}',
  })
  @IsOptional()
  @IsString()
  reference?: string;
}

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
    description: 'Minimum affiliate commission percentage',
    example: 0,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  affiliateCommissionMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum affiliate commission percentage',
    example: 100,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  affiliateCommissionMax?: number;

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

  @ApiPropertyOptional({
    description: 'Bank transfer details for invoice payments',
    type: BankTransferDetailsDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BankTransferDetailsDto)
  bankTransferDetails?: BankTransferDetailsDto;
}

