import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SellerSettingsService } from './seller-settings.service';
import { AVAILABLE_SHIPPING_COUNTRIES } from '../common/enums/shipping-countries.enum';

@ApiTags('seller-public')
@Controller('seller')
export class PublicSellerController {
  constructor(private readonly sellerSettingsService: SellerSettingsService) {}

  @Get('settings/shipping-countries')
  @ApiOperation({
    summary: 'Get available shipping countries (public)',
    description:
      'Returns all available shipping countries. No authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Available shipping countries retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        countries: {
          type: 'array',
          items: { type: 'string' },
          example: ['North Macedonia', 'Kosovo'],
        },
      },
    },
  })
  getAvailableShippingCountries() {
    return {
      countries: AVAILABLE_SHIPPING_COUNTRIES,
    };
  }

  @Get(':sellerId/shipping-countries')
  @ApiOperation({
    summary: 'Get seller shipping countries (public)',
    description:
      "Returns the specific seller's supported shipping countries. No authentication required.",
  })
  @ApiParam({
    name: 'sellerId',
    description: 'Seller ID',
    example: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller shipping countries retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        countries: {
          type: 'array',
          items: { type: 'string' },
          example: ['North Macedonia', 'Kosovo'],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  async getSellerShippingCountries(@Param('sellerId') sellerId: string) {
    const sellerSettings =
      await this.sellerSettingsService.getSellerShippingCountries(sellerId);

    if (!sellerSettings) {
      // If seller not found or has no settings, return empty array or all available
      return {
        countries: AVAILABLE_SHIPPING_COUNTRIES,
      };
    }

    // If seller has specific shipping countries set, return those
    // Otherwise return all available countries
    return {
      countries:
        sellerSettings.shippingCountries &&
        sellerSettings.shippingCountries.length > 0
          ? sellerSettings.shippingCountries
          : AVAILABLE_SHIPPING_COUNTRIES,
    };
  }
}
