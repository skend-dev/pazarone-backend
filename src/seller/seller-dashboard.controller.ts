import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SellerDashboardService } from './seller-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('seller-dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('seller/dashboard')
@UseGuards(JwtAuthGuard)
export class SellerDashboardController {
  constructor(private readonly dashboardService: SellerDashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStats(@CurrentUser() user: User) {
    return this.dashboardService.getStats(user.id);
  }

  @Get('recent-orders')
  @ApiOperation({ summary: 'Get recent orders for dashboard' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of orders to return (default: 10)' })
  @ApiResponse({ status: 200, description: 'Recent orders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getRecentOrders(
    @CurrentUser() user: User,
    @Query('limit') limit?: number,
  ) {
    return this.dashboardService.getRecentOrders(user.id, limit || 10);
  }
}

