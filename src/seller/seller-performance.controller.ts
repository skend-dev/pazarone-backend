import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SellerSettingsService } from './seller-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('seller-performance')
@ApiBearerAuth('JWT-auth')
@Controller('seller/performance')
@UseGuards(JwtAuthGuard)
export class SellerPerformanceController {
  constructor(private readonly settingsService: SellerSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get seller performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getPerformance(@CurrentUser() user: User) {
    return this.settingsService.getPerformance(user.id);
  }
}

