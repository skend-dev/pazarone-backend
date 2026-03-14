import { IsOptional, IsNumber, Min, IsString, IsEnum, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentMethod {
  COD = 'cod',
  CARD = 'card',
}

export class SellerPaymentsQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 'search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'cod',
    enum: PaymentMethod,
    description: 'Filter by payment method: cod or card',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    example: 'totalOutstanding',
    enum: ['totalOutstanding', 'codOutstanding', 'cardOutstanding'],
    description: 'Sort by outstanding amount (default: totalOutstanding)',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'totalOutstanding' | 'codOutstanding' | 'cardOutstanding';

  @ApiPropertyOptional({
    example: 'desc',
    enum: ['asc', 'desc'],
    description: 'Sort order - desc for biggest first (default)',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Include platform-wide totals (slower). Set false for faster table load.',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'false' || value === false ? false : true)
  @IsBoolean()
  includeTotals?: boolean;
}

