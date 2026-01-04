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
  ApiQuery,
} from '@nestjs/swagger';
import { AdminAffiliatesService } from './admin-affiliates.service';
import { AdminQueryDto } from './dto/admin-query.dto';
import { WithdrawalStatus } from '../affiliate/entities/affiliate-withdrawal.entity';
import { CommissionStatus } from '../affiliate/entities/affiliate-commission.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { VerifyPaymentMethodDto } from './dto/verify-payment-method.dto';
import { RejectPaymentMethodDto } from './dto/reject-payment-method.dto';

class UpdateWithdrawalStatusDto {
  @IsEnum(WithdrawalStatus)
  status: WithdrawalStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('admin-affiliates')
@ApiBearerAuth('JWT-auth')
@Controller('admin/affiliates')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
export class AdminAffiliatesController {
  constructor(
    private readonly adminAffiliatesService: AdminAffiliatesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all affiliates',
    description:
      'Returns paginated list of all affiliates with statistics (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Affiliates retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  findAll(@Query() query: AdminQueryDto) {
    return this.adminAffiliatesService.findAll(query);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get affiliate statistics',
    description: 'Returns platform-wide affiliate statistics (admin only)',
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
    return this.adminAffiliatesService.getStatistics();
  }

  @Get('withdrawals')
  @ApiOperation({
    summary: 'Get all withdrawal requests',
    description:
      'Returns paginated list of all withdrawal requests (admin only)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: WithdrawalStatus,
    description: 'Filter by withdrawal status',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawals retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  getWithdrawals(
    @Query() query: AdminQueryDto & { status?: WithdrawalStatus },
  ) {
    return this.adminAffiliatesService.getWithdrawals(query);
  }

  @Put('withdrawals/:id/status')
  @ApiOperation({
    summary: 'Update withdrawal status',
    description: 'Approve, reject, or mark withdrawal as paid (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Withdrawal not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  updateWithdrawalStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateWithdrawalStatusDto,
  ) {
    return this.adminAffiliatesService.updateWithdrawalStatus(
      id,
      updateDto.status,
      updateDto.notes,
    );
  }

  @Get('payment-methods')
  @ApiOperation({
    summary: 'Get all affiliate payment methods',
    description:
      'Returns paginated list of all affiliate payment methods with filtering options (admin only)',
  })
  @ApiQuery({
    name: 'verified',
    required: false,
    type: Boolean,
    description: 'Filter by verification status (true/false)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by affiliate name or email',
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
  @ApiResponse({
    status: 200,
    description: 'Payment methods retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  getPaymentMethods(
    @Query('verified')
    verified?: string,
    @Query('search')
    search?: string,
    @Query('page')
    page?: string,
    @Query('limit')
    limit?: string,
  ) {
    const verifiedBool =
      verified === undefined ? undefined : verified === 'true';
    return this.adminAffiliatesService.getPaymentMethods({
      verified: verifiedBool,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('payment-methods/:id')
  @ApiOperation({
    summary: 'Get payment method by ID',
    description:
      'Returns a single payment method with unmasked account number (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  getPaymentMethod(@Param('id') id: string) {
    return this.adminAffiliatesService.getPaymentMethod(id);
  }

  @Put('payment-methods/:id/verify')
  @ApiOperation({
    summary: 'Verify payment method',
    description: 'Marks a payment method as verified (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method verified successfully',
  })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - payment method already verified',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  verifyPaymentMethod(
    @Param('id') id: string,
    @Body() verifyDto: VerifyPaymentMethodDto,
  ) {
    return this.adminAffiliatesService.verifyPaymentMethod(id, verifyDto);
  }

  @Put('payment-methods/:id/reject')
  @ApiOperation({
    summary: 'Reject payment method',
    description:
      'Marks a payment method as unverified and adds rejection notes (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method rejected successfully',
  })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  rejectPaymentMethod(
    @Param('id') id: string,
    @Body() rejectDto: RejectPaymentMethodDto,
  ) {
    return this.adminAffiliatesService.rejectPaymentMethod(id, rejectDto);
  }

  @Get(':id/withdrawals')
  @ApiOperation({
    summary: 'Get withdrawals for a specific affiliate',
    description:
      'Returns paginated list of withdrawals for a specific affiliate (admin only)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: WithdrawalStatus,
    description: 'Filter by withdrawal status',
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
  @ApiResponse({
    status: 200,
    description: 'Withdrawals retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Affiliate not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  getAffiliateWithdrawals(
    @Param('id') id: string,
    @Query('status') status?: WithdrawalStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminAffiliatesService.getAffiliateWithdrawals(id, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id/commissions')
  @ApiOperation({
    summary: 'Get commissions for a specific affiliate',
    description:
      'Returns paginated list of commissions for a specific affiliate (admin only)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: CommissionStatus,
    description: 'Filter by commission status',
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
  @ApiResponse({
    status: 200,
    description: 'Commissions retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Affiliate not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  getAffiliateCommissions(
    @Param('id') id: string,
    @Query('status') status?: CommissionStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminAffiliatesService.getAffiliateCommissions(id, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id/payment-method')
  @ApiOperation({
    summary: 'Get payment method by affiliate ID',
    description:
      'Returns the payment method for a specific affiliate with unmasked account number (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Affiliate or payment method not found',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  getPaymentMethodByAffiliateId(@Param('id') id: string) {
    return this.adminAffiliatesService.getPaymentMethodByAffiliateId(id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get affiliate by ID',
    description:
      'Returns detailed information about a single affiliate (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Affiliate retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Affiliate not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  findOne(@Param('id') id: string) {
    return this.adminAffiliatesService.findOne(id);
  }
}
