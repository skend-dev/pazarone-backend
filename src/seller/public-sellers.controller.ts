import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SellerSettingsService } from './seller-settings.service';

@ApiTags('seller-public')
@Controller('sellers')
export class PublicSellersController {
  constructor(private readonly sellerSettingsService: SellerSettingsService) {}

  @Get('featured')
  @ApiOperation({
    summary: 'Get featured sellers (public)',
    description:
      'Returns a list of verified sellers with their stats (rating, reviews, products count, specialties). No authentication required.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of sellers to return (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured sellers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        sellers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              logo: { type: 'string', nullable: true },
              location: { type: 'string' },
              rating: { type: 'number', nullable: true },
              reviewsCount: { type: 'number' },
              productsCount: { type: 'number' },
              verified: { type: 'boolean' },
              responseTime: { type: 'string' },
              specialties: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  async getFeaturedSellers(@Query('limit') limit?: number) {
    return this.sellerSettingsService.getFeaturedSellers(
      limit ? parseInt(limit.toString(), 10) : 10,
    );
  }
}
