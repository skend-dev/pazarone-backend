import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminSellersService } from './admin-sellers.service';
import { AdminQueryDto } from './dto/admin-query.dto';
import { UpdateSellerPlatformFeeDto } from './dto/update-seller-platform-fee.dto';
import { SellerPaymentsQueryDto } from './dto/seller-payments-query.dto';
import { SellerPaymentOrdersQueryDto } from './dto/seller-payment-orders-query.dto';
import { MarkPaymentSettledDto } from './dto/mark-payment-settled.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@ApiTags('admin-sellers')
@ApiBearerAuth('JWT-auth')
@Controller('admin/sellers')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
export class AdminSellersController {
  constructor(private readonly adminSellersService: AdminSellersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all sellers',
    description:
      'Returns paginated list of all sellers with statistics (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Sellers retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  findAll(@Query() query: AdminQueryDto) {
    return this.adminSellersService.findAll(query);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get seller statistics',
    description: 'Returns platform-wide seller statistics (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  getStatistics() {
    return this.adminSellersService.getStatistics();
  }

  @Put(':id/platform-fee')
  @ApiOperation({
    summary: 'Update seller platform fee',
    description:
      'Update platform fee percentage for a specific seller. Set to null to use platform default (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform fee updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  updatePlatformFee(
    @Param('id') id: string,
    @Body() updateDto: UpdateSellerPlatformFeeDto,
  ) {
    return this.adminSellersService.updatePlatformFee(
      id,
      updateDto.platformFeePercent ?? null,
    );
  }

  @Put(':id/verify')
  @ApiOperation({
    summary: 'Verify a seller',
    description:
      'Verify a seller. Verified sellers get auto-approval for all new products (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller verified successfully. All pending products have been auto-approved.',
  })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  verifySeller(@Param('id') id: string) {
    return this.adminSellersService.verifySeller(id);
  }

  @Put(':id/unverify')
  @ApiOperation({
    summary: 'Unverify a seller',
    description:
      'Unverify a seller. New products from unverified sellers will require approval (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller unverified successfully',
  })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  unverifySeller(@Param('id') id: string) {
    return this.adminSellersService.unverifySeller(id);
  }

  @Get('payments')
  @ApiOperation({
    summary: 'Get seller payment summaries',
    description:
      'Returns paginated list of seller payment summaries with COD and Card outstanding amounts (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment summaries retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  getSellerPaymentSummaries(@Query() query: SellerPaymentsQueryDto) {
    return this.adminSellersService.getSellerPaymentSummaries(query);
  }

  @Get(':sellerId/payments/orders')
  @ApiOperation({
    summary: 'Get seller payment orders',
    description:
      'Returns paginated list of orders for a specific seller with payment details (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment orders retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  getSellerPaymentOrders(
    @Param('sellerId') sellerId: string,
    @Query() query: SellerPaymentOrdersQueryDto,
  ) {
    return this.adminSellersService.getSellerPaymentOrders(sellerId, query);
  }

  @Put(':sellerId/payments/cod/settle')
  @ApiOperation({
    summary: 'Mark COD payments as settled',
    description:
      'Mark one or more COD orders as paid by the seller (admin only). Sets sellerPaid to true and paymentSettledAt timestamp.',
  })
  @ApiResponse({
    status: 200,
    description: 'COD payments marked as settled successfully',
  })
  @ApiResponse({ status: 404, description: 'Seller not found or no matching orders' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  markCODPaymentsSettled(
    @Param('sellerId') sellerId: string,
    @Body() dto: MarkPaymentSettledDto,
  ) {
    return this.adminSellersService.markCODPaymentsSettled(sellerId, dto);
  }

  @Put(':sellerId/payments/card/settle')
  @ApiOperation({
    summary: 'Mark Card payments as settled',
    description:
      'Mark one or more Card orders as paid by admin to seller (admin only). Sets adminPaid to true and paymentSettledAt timestamp.',
  })
  @ApiResponse({
    status: 200,
    description: 'Card payments marked as settled successfully',
  })
  @ApiResponse({ status: 404, description: 'Seller not found or no matching orders' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  markCardPaymentsSettled(
    @Param('sellerId') sellerId: string,
    @Body() dto: MarkPaymentSettledDto,
  ) {
    return this.adminSellersService.markCardPaymentsSettled(sellerId, dto);
  }

  @Put(':id/freeze')
  @ApiOperation({
    summary: 'Freeze seller account',
    description:
      'Manually freeze a seller account. This applies payment restrictions, blocks new orders, and deactivates all products (admin only).',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller account frozen successfully',
  })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  freezeSeller(@Param('id') id: string) {
    return this.adminSellersService.freezeSeller(id);
  }

  @Put(':id/unfreeze')
  @ApiOperation({
    summary: 'Unfreeze seller account',
    description:
      'Manually unfreeze a seller account. This removes payment restrictions, allows new orders, and reactivates all inactive products (admin only).',
  })
  @ApiResponse({
    status: 200,
    description: 'Seller account unfrozen successfully. All inactive products have been reactivated.',
  })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  unfreezeSeller(@Param('id') id: string) {
    return this.adminSellersService.unfreezeSeller(id);
  }
}
