import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationsDto {
  @ApiPropertyOptional({ description: 'Enable/disable order notifications', example: true })
  @IsBoolean()
  @IsOptional()
  orders?: boolean;

  @ApiPropertyOptional({ description: 'Enable/disable review notifications', example: true })
  @IsBoolean()
  @IsOptional()
  reviews?: boolean;

  @ApiPropertyOptional({ description: 'Enable/disable message notifications', example: true })
  @IsBoolean()
  @IsOptional()
  messages?: boolean;

  @ApiPropertyOptional({ description: 'Enable/disable promotion notifications', example: true })
  @IsBoolean()
  @IsOptional()
  promotions?: boolean;

  @ApiPropertyOptional({
    description: 'Telegram chat ID for receiving order notifications. Get this by starting a conversation with your bot and sending /start',
    example: '123456789',
  })
  @IsString()
  @IsOptional()
  telegramChatId?: string;
}

