import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReturnOrderDto {
  @ApiProperty({
    description: 'Reason for return',
    example: 'Product was damaged during shipping',
  })
  @IsString()
  @IsNotEmpty()
  explanation: string;
}

