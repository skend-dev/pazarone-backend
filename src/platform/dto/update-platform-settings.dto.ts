import { IsNumber, IsOptional, Min, Max, IsObject, IsString, ValidateNested, IsBoolean, IsArray, IsInt, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ScheduleSlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day: number; // 0=Sun … 6=Sat

  @IsInt()
  @Min(0)
  @Max(23)
  hour: number; // Europe/Skopje
}

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
    description: 'Enable automatic promotion emails',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  automaticPromotionEmailsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Promotion email schedule: daily, weekly, or custom',
    example: 'daily',
    enum: ['daily', 'weekly', 'custom'],
  })
  @IsOptional()
  @IsString()
  promotionEmailSchedule?: 'daily' | 'weekly' | 'custom';

  @ApiPropertyOptional({
    description: 'Day of week for weekly schedule (0=Sun, 1=Mon, ..., 6=Sat)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  promotionEmailScheduleDayOfWeek?: number;

  @ApiPropertyOptional({
    description: 'Days of week for custom schedule, array of ints 0–6 (deprecated, use promotionEmailScheduleSlots)',
    example: [1, 3, 5],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  promotionEmailScheduleDays?: number[] | null;

  @ApiPropertyOptional({
    description: 'Per-day send-time slots for custom schedule. Each slot has a day (0–6) and hour (0–23, Europe/Skopje).',
    example: [{ day: 1, hour: 9 }, { day: 3, hour: 14 }],
    type: [ScheduleSlotDto],
  })
  @IsOptional()
  @ValidateIf((o) => o.promotionEmailScheduleSlots !== null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  promotionEmailScheduleSlots?: ScheduleSlotDto[] | null;

  @ApiPropertyOptional({
    description: 'Send flash deal emails (popular products on sale)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  promotionEmailsFlashDealsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Send new arrivals emails (newest products)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  promotionEmailsNewArrivalsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Hour of day (0–23, Europe/Skopje) to send automated emails',
    example: 9,
    minimum: 0,
    maximum: 23,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(23)
  promotionEmailSendHour?: number;

  @ApiPropertyOptional({
    description: 'Max number of products included in each automated email',
    example: 8,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  promotionEmailMaxProducts?: number;

  @ApiPropertyOptional({ description: 'Send automated emails to customers', example: true })
  @IsOptional()
  @IsBoolean()
  promotionEmailTargetCustomers?: boolean;

  @ApiPropertyOptional({ description: 'Send automated emails to sellers', example: true })
  @IsOptional()
  @IsBoolean()
  promotionEmailTargetSellers?: boolean;

  @ApiPropertyOptional({ description: 'Send automated emails to affiliates', example: true })
  @IsOptional()
  @IsBoolean()
  promotionEmailTargetAffiliates?: boolean;

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

