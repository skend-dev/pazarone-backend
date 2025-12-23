import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Receive order update notifications',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  orderUpdates?: boolean;

  @ApiPropertyOptional({
    description: 'Receive promotional emails',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  promotionalEmails?: boolean;

  @ApiPropertyOptional({
    description: 'Receive product recommendations',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  productRecommendations?: boolean;
}

