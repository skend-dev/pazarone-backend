import { IsArray, IsEnum, IsOptional, ArrayNotEmpty } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ShippingCountry,
  AVAILABLE_SHIPPING_COUNTRIES,
} from '../../common/enums/shipping-countries.enum';

export class UpdateShippingDto {
  @ApiPropertyOptional({
    description: 'Array of countries where seller supports shipping',
    enum: ShippingCountry,
    isArray: true,
    example: ['North Macedonia', 'Kosovo'],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one shipping country must be selected' })
  @IsEnum(ShippingCountry, { each: true, message: 'Invalid shipping country' })
  shippingCountries?: ShippingCountry[];
}
