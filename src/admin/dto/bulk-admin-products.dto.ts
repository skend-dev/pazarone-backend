import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BulkAdminProductAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate',
}

export class BulkAdminProductsDto {
  @ApiProperty({
    type: [String],
    description: 'Product IDs to update (max 100)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  productIds: string[];

  @ApiProperty({ enum: BulkAdminProductAction })
  @IsEnum(BulkAdminProductAction)
  action: BulkAdminProductAction;

  @ApiPropertyOptional({
    description: 'Required when action is reject',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  rejectionMessage?: string;
}
