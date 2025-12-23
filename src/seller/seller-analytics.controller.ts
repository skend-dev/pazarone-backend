import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SellerAnalyticsService } from './seller-analytics.service';
import {
  AnalyticsQueryDto,
  TopProductsQueryDto,
} from './dto/analytics-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('seller-analytics')
@ApiBearerAuth('JWT-auth')
@Controller('seller/analytics')
@UseGuards(JwtAuthGuard)
export class SellerAnalyticsController {
  constructor(private readonly analyticsService: SellerAnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get analytics overview with key metrics' })
  @ApiResponse({ status: 200, description: 'Analytics overview retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getOverview(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getOverview(user.id, query);
  }

  @Get('sales-trend')
  @ApiOperation({ summary: 'Get sales and revenue trend data for charts' })
  @ApiResponse({ status: 200, description: 'Sales trend data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSalesTrend(@CurrentUser() user: User, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getSalesTrend(user.id, query);
  }

  @Get('revenue-by-category')
  @ApiOperation({ summary: 'Get revenue breakdown by category' })
  @ApiResponse({ status: 200, description: 'Revenue by category retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getRevenueByCategory(
    @CurrentUser() user: User,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getRevenueByCategory(user.id, query);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Get top performing products' })
  @ApiResponse({ status: 200, description: 'Top products retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getTopProducts(
    @CurrentUser() user: User,
    @Query() query: TopProductsQueryDto,
  ) {
    return this.analyticsService.getTopProducts(user.id, query);
  }

  @Get('revenue-breakdown')
  @ApiOperation({
    summary: 'Get revenue breakdown with platform fee and affiliate commission',
    description: 'Returns total revenue, platform fee (7%), affiliate commission, and net revenue for the seller',
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue breakdown retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalRevenue: { type: 'number', description: 'Total revenue from all orders' },
        platformFee: { type: 'number', description: 'Platform fee (7% of total revenue)' },
        platformFeePercent: { type: 'number', description: 'Platform fee percentage (7)' },
        affiliateCommission: { type: 'number', description: 'Total affiliate commission paid' },
        netRevenue: { type: 'number', description: 'Net revenue after fees (totalRevenue - platformFee - affiliateCommission)' },
        period: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getRevenueBreakdown(
    @CurrentUser() user: User,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getRevenueBreakdown(user.id, query);
  }
}

