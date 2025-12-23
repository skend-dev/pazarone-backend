import { IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationStatus,
  NotificationType,
} from '../entities/notification.entity';

export class NotificationQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by notification status',
    enum: NotificationStatus,
  })
  @IsEnum(NotificationStatus)
  @IsOptional()
  status?: NotificationStatus;

  @ApiPropertyOptional({
    description: 'Filter by notification type',
    enum: NotificationType,
  })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;
}
