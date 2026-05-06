import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  ValidateIf,
  ArrayMinSize,
  MaxLength,
  IsUUID,
  ArrayMaxSize,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const TARGET_AUDIENCE = [
  'affiliate',
  'seller',
  'customer',
  'marketing_audience',
] as const;
export type TargetAudienceType = (typeof TARGET_AUDIENCE)[number];

export type UserRoleTargetAudienceType = Exclude<
  TargetAudienceType,
  'marketing_audience'
>;

export const DELIVERY_METHOD = ['email', 'notification', 'both'] as const;
export type DeliveryMethodType = (typeof DELIVERY_METHOD)[number];

export const BROADCAST_TYPE = [
  'promote_products_affiliates',
  'general_announcement',
  'marketing_products_customers',
] as const;
export type BroadcastType = (typeof BROADCAST_TYPE)[number];

export const BROADCAST_AUDIENCE_GENDERS = ['male', 'female'] as const;

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
    description:
      'Target audience: affiliate, seller, customer, and/or marketing_audience (Audience list with email; general announcements only)',
    example: ['affiliate', 'seller', 'customer'],
    enum: TARGET_AUDIENCE,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one target audience' })
  @IsIn(TARGET_AUDIENCE, { each: true })
  targetAudience: TargetAudienceType[];

  @ApiProperty({
    description:
      'Delivery method: email only, in-app notification only, or both',
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

  @ApiPropertyOptional({
    description:
      'Optional: male or female — narrows Audience list and customer recipients only.',
    enum: BROADCAST_AUDIENCE_GENDERS,
    example: 'female',
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsIn(BROADCAST_AUDIENCE_GENDERS)
  audienceGender?: (typeof BROADCAST_AUDIENCE_GENDERS)[number];

  @ApiPropertyOptional({
    description:
      'Max number of recipients to send to. Recipients are taken in the natural order ' +
      '(users first, then audience contacts). Omit or set to 0 to send to everyone.',
    minimum: 1,
    maximum: 100_000,
    example: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  recipientLimit?: number;
}
