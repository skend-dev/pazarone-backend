import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  Matches,
  ValidateIf,
  Validate,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BankAccountNumberConstraint,
  MacedoniaIbanConstraint,
} from '../utils/bank-validators';

export class UpdatePaymentMethodDto {
  @ApiProperty({
    description: 'Bank name',
    example: 'Halkbank',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  bankName: string;

  @ApiProperty({
    description:
      'Bank account number (15 digits for Halkbank, 8-20 digits for other banks)',
    example: '123456789012345',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Validate(BankAccountNumberConstraint)
  accountNumber: string;

  @ApiProperty({
    description: 'Account holder name',
    example: 'Skender Mustafa',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  accountHolderName: string;

  @ApiPropertyOptional({
    description:
      'IBAN (International Bank Account Number) - Format: MK + 2 check digits + 3 bank code + 10 account digits + 2 check digits',
    example: 'MK07250120000058984',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @ValidateIf((o) => o.iban !== undefined && o.iban !== null)
  @Validate(MacedoniaIbanConstraint)
  iban?: string;

  @ApiPropertyOptional({
    description: 'SWIFT/BIC code',
    example: 'HALKMK22',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  @ValidateIf((o) => o.swiftCode !== undefined && o.swiftCode !== null)
  @Matches(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/i, {
    message: 'SWIFT/BIC code format is invalid',
  })
  swiftCode?: string;

  @ApiPropertyOptional({
    description: 'Bank address',
    example: '123 Main Street, Skopje, North Macedonia',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  bankAddress?: string;
}

