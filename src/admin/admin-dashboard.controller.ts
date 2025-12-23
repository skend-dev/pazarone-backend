import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@ApiTags('admin-dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get admin dashboard statistics',
    description: 'Returns platform-wide statistics including users, orders, revenue, products, and affiliates (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  getStats() {
    return this.adminDashboardService.getStats();
  }
}

