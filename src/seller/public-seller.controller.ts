import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SellerSettingsService } from './seller-settings.service';
import { AVAILABLE_SHIPPING_COUNTRIES } from '../common/enums/shipping-countries.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductStatus } from '../products/entities/product.entity';

@ApiTags('seller-public')
@Controller('seller')
export class PublicSellerController {
  constructor(
    private readonly sellerSettingsService: SellerSettingsService,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

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

  @Get(':sellerId/profile')
  @ApiOperation({
    summary: 'Get seller public profile',
    description:
      'Returns public seller profile information including store details, verification status, and statistics. No authentication required.',
  })
  @ApiParam({
    name: 'sellerId',
    description: 'Seller ID',
    example: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        storeName: { type: 'string', nullable: true },
        storeDescription: { type: 'string', nullable: true },
        logo: { type: 'string', nullable: true },
        verified: { type: 'boolean' },
        market: { type: 'string', example: 'MK' },
        shippingCountries: {
          type: 'array',
          items: { type: 'string' },
        },
        stats: {
          type: 'object',
          properties: {
            totalProducts: { type: 'number' },
            activeProducts: { type: 'number' },
            totalViews: { type: 'number' },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        profileUrl: {
          type: 'string',
          description: 'URL to seller profile page',
          example: '/seller/{sellerId}/profile',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  async getSellerProfile(@Param('sellerId') sellerId: string) {
    const profile = await this.sellerSettingsService.getPublicProfile(sellerId);

    // Get seller statistics
    const [totalProducts, activeProducts] = await Promise.all([
      this.productsRepository.count({
        where: { sellerId },
      }),
      this.productsRepository.count({
        where: { sellerId, status: ProductStatus.ACTIVE, approved: true },
      }),
    ]);

    // Calculate total views
    const totalViewsResult = await this.productsRepository
      .createQueryBuilder('product')
      .select('SUM(product.views)', 'total')
      .where('product.sellerId = :sellerId', { sellerId })
      .getRawOne();
    const totalViews = parseInt(totalViewsResult?.total || '0', 10);

    return {
      ...profile,
      stats: {
        totalProducts,
        activeProducts,
        totalViews,
      },
      profileUrl: `/seller/${sellerId}/profile`,
    };
  }
}
