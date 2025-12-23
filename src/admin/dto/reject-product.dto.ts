import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectProductDto {
  @ApiProperty({
    description: 'Rejection message to send to the seller',
    example: 'Your product does not meet our quality standards. Please review and resubmit.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

