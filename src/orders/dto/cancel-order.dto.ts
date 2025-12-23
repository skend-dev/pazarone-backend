import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelOrderDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'Customer requested cancellation due to change of mind',
  })
  @IsString()
  @IsNotEmpty()
  explanation: string;
}

