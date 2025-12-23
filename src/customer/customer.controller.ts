import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { OrdersService } from '../orders/orders.service';
import { CustomerOrderQueryDto } from '../orders/dto/customer-order-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { CancelOrderDto } from '../orders/dto/cancel-order.dto';
import { ReturnOrderDto } from '../orders/dto/return-order.dto';

@ApiTags('customer')
@ApiBearerAuth('JWT-auth')
@Controller('customer')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get customer profile',
    description: 'Get customer profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            userType: { type: 'string', enum: ['customer'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async getProfile(@CurrentUser() user: User) {
    const profile = await this.customerService.getProfile(user.id);
    return {
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        userType: profile.userType,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    };
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update customer profile',
    description: 'Update customer name and profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            userType: { type: 'string', enum: ['customer'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const updatedUser = await this.customerService.updateProfile(
      user.id,
      updateProfileDto,
    );
    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        userType: updatedUser.userType,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    };
  }

  @Put('password')
  @ApiOperation({
    summary: 'Change customer password',
    description: 'Change customer password with current password validation',
  })
  @ApiResponse({
    status: 200,
    description: 'Password updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Password updated successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Current password is incorrect' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.customerService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
    return { message: 'Password updated successfully' };
  }

  @Get('addresses')
  @ApiOperation({
    summary: 'Get all customer addresses',
    description: 'Retrieve all saved addresses for the authenticated customer',
  })
  @ApiResponse({
    status: 200,
    description: 'Addresses retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        addresses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              street: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              zip: { type: 'string' },
              country: { type: 'string' },
              phone: { type: 'string' },
              isDefault: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async getAddresses(@CurrentUser() user: User) {
    const addresses = await this.customerService.getAddresses(user.id);
    return { addresses };
  }

  @Get('addresses/default')
  @ApiOperation({
    summary: 'Get default customer address',
    description:
      'Retrieve the default shipping address for the authenticated customer',
  })
  @ApiResponse({
    status: 200,
    description: 'Default address retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        address: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            street: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zip: { type: 'string' },
            country: { type: 'string' },
            phone: { type: 'string' },
            isDefault: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No default address found',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async getDefaultAddress(@CurrentUser() user: User) {
    const address = await this.customerService.getDefaultAddress(user.id);
    if (!address) {
      throw new NotFoundException('No default address found');
    }
    return { address };
  }

  @Post('addresses')
  @ApiOperation({
    summary: 'Create a new address',
    description: 'Create a new shipping address for the customer',
  })
  @ApiResponse({
    status: 201,
    description: 'Address created successfully',
    schema: {
      type: 'object',
      properties: {
        address: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            street: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zip: { type: 'string' },
            country: { type: 'string' },
            phone: { type: 'string' },
            isDefault: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async createAddress(
    @CurrentUser() user: User,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    const address = await this.customerService.createAddress(
      user.id,
      createAddressDto,
    );
    return { address };
  }

  @Post('address')
  @ApiOperation({
    summary: 'Create a new address (alias)',
    description: 'Alias for POST /api/customer/addresses',
  })
  @ApiResponse({
    status: 201,
    description: 'Address created successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async createAddressAlias(
    @CurrentUser() user: User,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.createAddress(user, createAddressDto);
  }

  @Put('addresses/:id')
  @ApiOperation({
    summary: 'Update an address',
    description: 'Update an existing customer address',
  })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiResponse({
    status: 200,
    description: 'Address updated successfully',
    schema: {
      type: 'object',
      properties: {
        address: {
          type: 'object',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Address not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async updateAddress(
    @CurrentUser() user: User,
    @Param('id') addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    const address = await this.customerService.updateAddress(
      user.id,
      addressId,
      updateAddressDto,
    );
    return { address };
  }

  @Delete('addresses/:id')
  @ApiOperation({
    summary: 'Delete an address',
    description: 'Delete a customer address (cannot delete last address)',
  })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiResponse({
    status: 200,
    description: 'Address deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Address deleted successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot delete last address' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async deleteAddress(
    @CurrentUser() user: User,
    @Param('id') addressId: string,
  ) {
    await this.customerService.deleteAddress(user.id, addressId);
    return { message: 'Address deleted successfully' };
  }

  @Put('addresses/:id/set-default')
  @ApiOperation({
    summary: 'Set default address',
    description: 'Set an address as the default shipping address',
  })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiResponse({
    status: 200,
    description: 'Default address set successfully',
    schema: {
      type: 'object',
      properties: {
        address: {
          type: 'object',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Address not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async setDefaultAddress(
    @CurrentUser() user: User,
    @Param('id') addressId: string,
  ) {
    const address = await this.customerService.setDefaultAddress(
      user.id,
      addressId,
    );
    return { address };
  }

  @Get('notifications/preferences')
  @ApiOperation({
    summary: 'Get notification preferences',
    description: 'Get customer notification preferences',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        preferences: {
          type: 'object',
          properties: {
            orderUpdates: { type: 'boolean' },
            promotionalEmails: { type: 'boolean' },
            productRecommendations: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async getNotificationPreferences(@CurrentUser() user: User) {
    const preferences = await this.customerService.getNotificationPreferences(
      user.id,
    );
    return {
      preferences: {
        orderUpdates: preferences.orderUpdates,
        promotionalEmails: preferences.promotionalEmails,
        productRecommendations: preferences.productRecommendations,
      },
    };
  }

  @Put('notifications/preferences')
  @ApiOperation({
    summary: 'Update notification preferences',
    description: 'Update customer notification preferences',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
    schema: {
      type: 'object',
      properties: {
        preferences: {
          type: 'object',
          properties: {
            orderUpdates: { type: 'boolean' },
            promotionalEmails: { type: 'boolean' },
            productRecommendations: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async updateNotificationPreferences(
    @CurrentUser() user: User,
    @Body() updateDto: UpdateNotificationPreferencesDto,
  ) {
    const preferences =
      await this.customerService.updateNotificationPreferences(
        user.id,
        updateDto,
      );
    return {
      preferences: {
        orderUpdates: preferences.orderUpdates,
        promotionalEmails: preferences.promotionalEmails,
        productRecommendations: preferences.productRecommendations,
      },
    };
  }

  @Get('orders')
  @ApiOperation({
    summary: 'Get all orders for the authenticated customer',
    description: 'Returns a paginated list of orders for the current customer',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
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
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by order number or seller name',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'End date (ISO 8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: { type: 'object' },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - customer access required',
  })
  async getOrders(
    @CurrentUser() user: User,
    @Query() query: CustomerOrderQueryDto,
  ) {
    return this.ordersService.findAllForCustomer(user.id, query);
  }

  @Get('orders/:id')
  @ApiOperation({
    summary: 'Get a single order by ID',
    description: 'Get order details for the authenticated customer',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your order' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOrder(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ordersService.findOneForCustomer(id, user.id);
  }

  @Post('orders/:id/cancel')
  @ApiOperation({
    summary: 'Cancel an order',
    description:
      'Cancel an order. Only pending or processing orders can be cancelled. Requires explanation.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request (e.g., order already delivered or cannot be cancelled)',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your order' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async cancelOrder(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() cancelOrderDto: CancelOrderDto,
  ) {
    return this.ordersService.cancel(
      id,
      user.id,
      'customer',
      cancelOrderDto.explanation,
    );
  }

  @Post('orders/:id/return')
  @ApiOperation({
    summary: 'Return an order',
    description: 'Return a delivered order. Requires explanation.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order returned successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g., order not delivered)',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your order' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async returnOrder(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() returnOrderDto: ReturnOrderDto,
  ) {
    return this.ordersService.returnOrder(
      id,
      user.id,
      'customer',
      returnOrderDto.explanation,
    );
  }
}
