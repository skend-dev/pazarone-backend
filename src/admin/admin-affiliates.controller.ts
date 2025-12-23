import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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
  constructor(private readonly adminAffiliatesService: AdminAffiliatesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all affiliates',
    description: 'Returns paginated list of all affiliates with statistics (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Affiliates retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  findAll(@Query() query: AdminQueryDto) {
    return this.adminAffiliatesService.findAll(query);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get affiliate statistics',
    description: 'Returns platform-wide affiliate statistics (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  getStatistics() {
    return this.adminAffiliatesService.getStatistics();
  }

  @Get('withdrawals')
  @ApiOperation({
    summary: 'Get all withdrawal requests',
    description: 'Returns paginated list of all withdrawal requests (admin only)',
  })
  @ApiQuery({ name: 'status', required: false, enum: WithdrawalStatus, description: 'Filter by withdrawal status' })
  @ApiResponse({ status: 200, description: 'Withdrawals retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  getWithdrawals(@Query() query: AdminQueryDto & { status?: WithdrawalStatus }) {
    return this.adminAffiliatesService.getWithdrawals(query);
  }

  @Put('withdrawals/:id/status')
  @ApiOperation({
    summary: 'Update withdrawal status',
    description: 'Approve, reject, or mark withdrawal as paid (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Withdrawal status updated successfully' })
  @ApiResponse({ status: 404, description: 'Withdrawal not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
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
}

