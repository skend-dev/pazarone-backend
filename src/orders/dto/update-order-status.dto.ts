import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Order status',
    enum: OrderStatus,
    example: OrderStatus.PROCESSING,
  })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @ApiPropertyOptional({
    description: 'Tracking ID (optional, can be added later)',
    example: 'TRK-789456123',
  })
  @IsString()
  @IsOptional()
  trackingId?: string;

  @ApiPropertyOptional({
    description:
      'Explanation/reason for cancellation or return (required when status is cancelled or returned)',
    example: 'Customer requested cancellation due to change of mind',
  })
  @ValidateIf(
    (o) =>
      o.status === OrderStatus.CANCELLED || o.status === OrderStatus.RETURNED,
  )
  @IsString()
  @IsNotEmpty({
    message:
      'Explanation is required when status is cancelled or returned',
  })
  statusExplanation?: string;
}

