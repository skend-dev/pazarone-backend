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
}
