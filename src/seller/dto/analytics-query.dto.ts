import { IsOptional, IsString, IsDateString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum AnalyticsPeriod {
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.MONTH;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class TopProductsQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: 'revenue' | 'sales' = 'revenue';
}

