import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkReadDto {
  @ApiProperty({
    description: 'Array of notification IDs to mark as read',
    type: [String],
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '223e4567-e89b-12d3-a456-426614174001',
    ],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  notificationIds: string[];
}
