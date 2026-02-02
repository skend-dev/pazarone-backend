import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  ArrayMinSize,
  MaxLength,
  IsUUID,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const TARGET_AUDIENCE = ['affiliate', 'seller', 'customer'] as const;
export type TargetAudienceType = (typeof TARGET_AUDIENCE)[number];

export const DELIVERY_METHOD = ['email', 'notification', 'both'] as const;
export type DeliveryMethodType = (typeof DELIVERY_METHOD)[number];

export const BROADCAST_TYPE = [
  'promote_products_affiliates',
  'general_announcement',
  'marketing_products_customers',
] as const;
export type BroadcastType = (typeof BROADCAST_TYPE)[number];

export class CreateBroadcastDto {
  @ApiProperty({
    description: 'Broadcast type: controls audience and product link behavior',
    enum: BROADCAST_TYPE,
  })
  @IsIn(BROADCAST_TYPE)
  broadcastType: BroadcastType;

  @ApiProperty({
    description: 'Announcement title',
    example: 'New seasonal sale',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(120, { message: 'Title must be at most 120 characters' })
  title: string;

  @ApiProperty({
    description: 'Announcement message body',
    example: 'Check out our latest offers for this season.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  @MaxLength(2000, { message: 'Message must be at most 2000 characters' })
  message: string;

  @ApiProperty({
    description: 'Target audience: affiliate, seller, and/or customer',
    example: ['affiliate', 'seller', 'customer'],
    enum: TARGET_AUDIENCE,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one target audience' })
  @IsIn(TARGET_AUDIENCE, { each: true })
  targetAudience: TargetAudienceType[];

  @ApiProperty({
    description: 'Delivery method: email only, in-app notification only, or both',
    enum: DELIVERY_METHOD,
  })
  @IsIn(DELIVERY_METHOD)
  deliveryMethod: DeliveryMethodType;

  @ApiPropertyOptional({
    description: 'Product IDs to feature in the email (max 10 recommended)',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    type: [String],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(10)
  featuredProductIds?: string[];
}
