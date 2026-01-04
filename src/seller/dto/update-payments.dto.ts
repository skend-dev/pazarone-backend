import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentsDto {
  @ApiPropertyOptional({
    description: 'Bank account (legacy field)',
    example: '1234567890',
  })
  @IsString()
  @IsOptional()
  bankAccount?: string;

  @ApiPropertyOptional({
    description: 'Bank name',
    example: 'Example Bank',
  })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({
    description: 'Bank account number',
    example: '1234567890',
  })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional({
    description: 'Account holder name',
    example: 'John Doe',
  })
  @IsString()
  @IsOptional()
  accountHolder?: string;

  @ApiPropertyOptional({
    description: 'IBAN',
    example: 'MK123456789012345678',
  })
  @IsString()
  @IsOptional()
  iban?: string;

  @ApiPropertyOptional({
    description: 'SWIFT/BIC code',
    example: 'ABCDMK2X',
  })
  @IsString()
  @IsOptional()
  swift?: string;

  @ApiPropertyOptional({
    description: 'Tax ID',
    example: '123456789',
  })
  @IsString()
  @IsOptional()
  taxId?: string;
}

