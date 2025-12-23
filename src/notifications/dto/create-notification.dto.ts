import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'User ID to receive the notification',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.ORDER_CREATED,
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Notification title',
    example: 'New Order Received',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'You have received a new order #ORD-12345',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Additional metadata (orderId, productId, etc.)',
    example: { orderId: '123e4567-e89b-12d3-a456-426614174000' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Link to navigate when notification is clicked',
    example: '/orders/123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUrl()
  @IsOptional()
  link?: string;
}
