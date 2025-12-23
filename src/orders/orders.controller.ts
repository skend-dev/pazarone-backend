import {
  Controller,
  Get,
  Param,
  Put,
  Body,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('seller-orders')
@ApiBearerAuth('JWT-auth')
@Controller('seller/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all orders for the seller' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentUser() user: User, @Query() query: OrderQueryDto) {
    return this.ordersService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ordersService.findOne(id, user.id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order status updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updateStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, user.id, updateOrderStatusDto);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search orders',
    description: 'Search orders by order number, customer name, or customer email',
  })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search term' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'all',
      'pending',
      'processing',
      'in_transit',
      'delivered',
      'cancelled',
      'returned',
    ],
    description: 'Filter by status',
  })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - search term is required' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  search(
    @CurrentUser() user: User,
    @Query('q') searchTerm: string,
    @Query() query: OrderQueryDto,
  ) {
    if (!searchTerm || searchTerm.trim() === '') {
      throw new BadRequestException('Search term is required');
    }
    return this.ordersService.search(user.id, searchTerm, query);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get order statistics',
    description: 'Get order statistics including counts by status, revenue, and average order value',
  })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStatistics(
    @CurrentUser() user: User,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.ordersService.getStatistics(user.id, dateFrom, dateTo);
  }

  @Put(':id/cancel')
  @ApiOperation({
    summary: 'Cancel an order (seller)',
    description: 'Cancel an order. Only pending or processing orders can be cancelled. Requires explanation.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., order already delivered)' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  cancel(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() cancelOrderDto: CancelOrderDto,
  ) {
    return this.ordersService.cancel(id, user.id, 'seller', cancelOrderDto.explanation);
  }

  @Put(':id/return')
  @ApiOperation({
    summary: 'Return an order (seller)',
    description: 'Return a delivered order. Requires explanation.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order returned successfully' })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., order not delivered)' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  returnOrder(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() returnOrderDto: ReturnOrderDto,
  ) {
    return this.ordersService.returnOrder(id, user.id, 'seller', returnOrderDto.explanation);
  }

  @Get(':id/invoice')
  @ApiOperation({ summary: 'Get order invoice' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiQuery({ name: 'format', required: false, enum: ['pdf', 'json'], description: 'Invoice format' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  getInvoice(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('format') format: string = 'json',
  ) {
    // TODO: Implement invoice generation
    return this.ordersService.findOne(id, user.id);
  }
}

