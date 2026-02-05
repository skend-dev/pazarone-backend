import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
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
import { CreateOrderDto } from './dto/create-order.dto';
import { CustomerOrderQueryDto } from './dto/customer-order-query.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserType } from '../users/entities/user.entity';

@ApiTags('orders')
@Controller('orders')
export class PublicOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new order (public - guest and register checkout)',
    description:
      'Create a new order. Authenticated customers: order is attached to the session (no verificationToken). ' +
      'Guest (checkoutType=guest): no account, no verification. Register (checkoutType=register or omitted, unauthenticated): valid verificationToken required.',
  })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., insufficient stock, email verification required)' })
  @ApiResponse({ status: 401, description: 'Unauthorized (e.g., invalid or missing verification token for register checkout)' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  create(
    @CurrentUser() user: User | undefined,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    const customerId =
      user?.userType === UserType.CUSTOMER ? user.id : null;
    return this.ordersService.create(customerId, createOrderDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all orders for the authenticated customer',
    description: 'Returns a paginated list of orders for the current customer.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    enum: ['all', 'pending', 'processing', 'in_transit', 'delivered', 'cancelled', 'returned'],
    description: 'Filter by status' 
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by order number or seller name' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentUser() user: User, @Query() query: CustomerOrderQueryDto) {
    return this.ordersService.findAllForCustomer(user.id, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get a single order by ID',
    description: 'Returns order details for the authenticated customer.',
  })
  @ApiParam({ name: 'id', description: 'Order ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ordersService.findOneForCustomer(id, user.id);
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cancel an order',
    description: 'Cancel an order. Only pending or processing orders can be cancelled. Requires explanation.',
  })
  @ApiParam({ name: 'id', description: 'Order ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., order already delivered)' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  cancel(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() cancelOrderDto: CancelOrderDto,
  ) {
    return this.ordersService.cancel(id, user.id, 'customer', cancelOrderDto.explanation);
  }

  @Put(':id/return')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Return an order',
    description: 'Return a delivered order. Requires explanation.',
  })
  @ApiParam({ name: 'id', description: 'Order ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Order returned successfully' })
  @ApiResponse({ status: 400, description: 'Bad request (e.g., order not delivered)' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  returnOrder(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() returnOrderDto: ReturnOrderDto,
  ) {
    return this.ordersService.returnOrder(id, user.id, 'customer', returnOrderDto.explanation);
  }
}

