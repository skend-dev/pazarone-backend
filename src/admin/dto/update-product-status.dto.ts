import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProductStatusDto {
  @ApiProperty({
    description: 'Set to true to activate the product, false to deactivate',
    example: true,
  })
  @IsBoolean()
  active: boolean;
}
