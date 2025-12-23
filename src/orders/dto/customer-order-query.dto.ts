import { IsOptional, IsString, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerOrderQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['all', 'pending', 'processing', 'in_transit', 'delivered', 'cancelled'],
    example: 'pending',
  })
  @IsOptional()
  @IsString()
  status?: 'all' | 'pending' | 'processing' | 'in_transit' | 'delivered' | 'cancelled';

  @ApiPropertyOptional({ description: 'Search by order number', example: 'ORD-123456' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)', example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)', example: '2024-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

