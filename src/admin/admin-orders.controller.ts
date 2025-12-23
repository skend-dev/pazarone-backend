import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminOrdersService } from './admin-orders.service';
import { AdminQueryDto } from './dto/admin-query.dto';
import { OrderStatus } from '../orders/entities/order.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@ApiTags('admin-orders')
@ApiBearerAuth('JWT-auth')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all orders',
    description: 'Returns paginated list of all orders across all sellers (admin only)',
  })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus, description: 'Filter by order status' })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  findAll(
    @Query()
    query: AdminQueryDto & {
      status?: OrderStatus;
      sellerId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    return this.adminOrdersService.findAll(query);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get order statistics',
    description: 'Returns platform-wide order statistics (admin only)',
  })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  getStatistics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminOrdersService.getStatistics(dateFrom, dateTo);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order by ID',
    description: 'Returns a specific order with full details (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  findOne(@Param('id') id: string) {
    return this.adminOrdersService.findOne(id);
  }
}

