import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { ForbiddenException } from '@nestjs/common';

@ApiTags('affiliate-analytics')
@ApiBearerAuth('JWT-auth')
@Controller('affiliate/analytics')
@UseGuards(JwtAuthGuard)
export class AffiliateAnalyticsController {
  constructor(private readonly affiliateService: AffiliateService) {}

  private validateAffiliate(user: User) {
    if (user.userType !== UserType.AFFILIATE) {
      throw new ForbiddenException('This endpoint is only available for affiliate users');
    }
  }

  @Get('commissions')
  @ApiOperation({
    summary: 'Get affiliate commissions',
    description: 'Returns paginated list of commissions with order and product details',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: CommissionStatus,
    description: 'Filter by commission status',
  })
  @ApiResponse({ status: 200, description: 'Commissions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - user is not an affiliate' })
  getCommissions(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: CommissionStatus,
  ) {
    this.validateAffiliate(user);
    return this.affiliateService.getCommissions(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      status,
    );
  }

  @Get('earnings')
  @ApiOperation({
    summary: 'Get earnings by period',
    description: 'Returns earnings breakdown by date for approved commissions',
  })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Earnings retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - user is not an affiliate' })
  getEarnings(
    @CurrentUser() user: User,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    this.validateAffiliate(user);
    return this.affiliateService.getEarningsByPeriod(
      user.id,
      new Date(startDate),
      new Date(endDate),
    );
  }
}

