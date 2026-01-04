import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AffiliateService } from './affiliate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserType } from '../users/entities/user.entity';
import { CommissionStatus } from './entities/affiliate-commission.entity';
import { WithdrawalStatus } from './entities/affiliate-withdrawal.entity';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

@ApiTags('affiliate-dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('affiliate/dashboard')
@UseGuards(JwtAuthGuard)
export class AffiliateDashboardController {
  constructor(private readonly affiliateService: AffiliateService) {}

  private validateAffiliate(user: User) {
    if (user.userType !== UserType.AFFILIATE) {
      throw new ForbiddenException(
        'This endpoint is only available for affiliate users',
      );
    }
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get affiliate dashboard statistics',
    description:
      'Returns referral code, link, clicks, orders, earnings breakdown, available balance, and withdrawal information',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard stats retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        referralCode: { type: 'string', example: 'AFF-ABC123' },
        referralLink: {
          type: 'string',
          example: 'http://localhost:3000?ref=AFF-ABC123',
        },
        totalClicks: { type: 'number', example: 150 },
        totalOrders: { type: 'number', example: 25 },
        pendingEarnings: { type: 'number', example: 100.5 },
        approvedEarnings: { type: 'number', example: 500.0 },
        paidEarnings: { type: 'number', example: 300.0 },
        totalEarnings: { type: 'number', example: 800.0 },
        availableBalance: {
          type: 'number',
          example: 450.0,
          description:
            'Available balance after subtracting pending/approved withdrawals',
        },
        pendingWithdrawals: {
          type: 'number',
          example: 50.0,
          description:
            'Total amount locked in pending/approved withdrawal requests',
        },
        minimumWithdrawal: { type: 'number', example: 1000 },
        canWithdraw: {
          type: 'boolean',
          example: false,
          description:
            'Whether user can withdraw (must meet minimum threshold AND not have withdrawal this month)',
        },
        hasWithdrawalThisMonth: {
          type: 'boolean',
          example: false,
          description: 'Whether a withdrawal was already requested this month',
        },
        nextWithdrawalDate: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          example: '2024-02-01T00:00:00Z',
          description:
            'Date when next withdrawal can be requested (null if can request now)',
        },
        pendingCount: { type: 'number', example: 5 },
        approvedCount: { type: 'number', example: 10 },
        paidCount: { type: 'number', example: 8 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an affiliate',
  })
  getStats(@CurrentUser() user: User) {
    this.validateAffiliate(user);
    return this.affiliateService.getDashboardStats(user.id);
  }

  @Get('referral-code')
  @ApiOperation({
    summary: 'Get or create referral code',
    description:
      'Returns the affiliate referral code, creates one if it does not exist',
  })
  @ApiResponse({
    status: 200,
    description: 'Referral code retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        referralCode: { type: 'string', example: 'AFF-ABC123' },
        referralLink: {
          type: 'string',
          example: 'http://localhost:3000?ref=AFF-ABC123',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an affiliate',
  })
  async getReferralCode(@CurrentUser() user: User) {
    this.validateAffiliate(user);
    const referralCode = await this.affiliateService.getOrCreateReferralCode(
      user.id,
    );
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return {
      referralCode,
      referralLink: `${baseUrl}?ref=${referralCode}`,
    };
  }

  @Post('withdraw')
  @ApiOperation({
    summary: 'Request withdrawal',
    description:
      'Request a withdrawal of approved earnings. Minimum withdrawal threshold must be met.',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid' },
        amount: { type: 'number', example: 1500 },
        status: { type: 'string', example: 'pending' },
        paymentMethod: { type: 'string', example: 'bank_transfer' },
        createdAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - insufficient balance or below minimum threshold',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user is not an affiliate',
  })
  async requestWithdrawal(
    @CurrentUser() user: User,
    @Body() requestWithdrawalDto: RequestWithdrawalDto,
  ) {
    this.validateAffiliate(user);
    const withdrawal = await this.affiliateService.requestWithdrawal(
      user.id,
      requestWithdrawalDto.amount,
      requestWithdrawalDto.paymentMethod,
      requestWithdrawalDto.paymentDetails,
    );

    // Format response to match frontend expectations
    return {
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawalRequest: {
        id: withdrawal.id,
        amount: parseFloat(withdrawal.amount.toString()),
        status: withdrawal.status,
        requestedAt: withdrawal.createdAt,
      },
    };
  }

  @Get('withdrawals')
  @ApiOperation({
    summary: 'Get withdrawal history',
    description: 'Returns paginated list of withdrawal requests',
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
    description: 'Forbidden - user is not an affiliate',
  })
  getWithdrawals(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: WithdrawalStatus,
  ) {
    this.validateAffiliate(user);
    return this.affiliateService.getWithdrawals(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      status,
    );
  }
}
