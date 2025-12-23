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
import { WithdrawalStatus } from './entities/affiliate-withdrawal.entity';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('affiliate-withdrawals')
@ApiBearerAuth('JWT-auth')
@Controller('affiliate/withdrawals')
@UseGuards(JwtAuthGuard)
export class AffiliateWithdrawalsController {
  constructor(private readonly affiliateService: AffiliateService) {}

  private validateAffiliate(user: User) {
    if (user.userType !== UserType.AFFILIATE) {
      throw new ForbiddenException('This endpoint is only available for affiliate users');
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Request withdrawal',
    description: 'Request a withdrawal of approved earnings. Minimum withdrawal threshold must be met.',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Withdrawal request submitted successfully' },
        withdrawalRequest: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid' },
            amount: { type: 'number', example: 1500.00 },
            status: { type: 'string', example: 'pending' },
            requestedAt: { type: 'string', example: '2024-01-15T10:30:00Z' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - insufficient balance or below minimum threshold' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - user is not an affiliate' })
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

  @Get()
  @ApiOperation({
    summary: 'Get withdrawal history',
    description: 'Returns paginated list of withdrawal requests',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: WithdrawalStatus,
    description: 'Filter by withdrawal status',
  })
  @ApiResponse({ status: 200, description: 'Withdrawals retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - user is not an affiliate' })
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

