import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserType } from '../users/entities/user.entity';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('affiliate-settings')
@ApiBearerAuth('JWT-auth')
@Controller('affiliate')
@UseGuards(JwtAuthGuard)
export class AffiliateSettingsController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}

  @Get('platform-settings')
  @ApiOperation({
    summary: 'Get platform settings for affiliates',
    description: 'Returns minimum withdrawal threshold and other affiliate-relevant platform settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform settings retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        affiliateMinWithdrawalThreshold: { type: 'number', example: 1000 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - affiliate access required' })
  async getPlatformSettings(@CurrentUser() user: User) {
    // Only allow affiliates to access this endpoint
    if (user.userType !== UserType.AFFILIATE) {
      throw new ForbiddenException('This endpoint is only available for affiliate users');
    }

    const settings = await this.platformSettingsService.getSettings();
    return {
      affiliateMinWithdrawalThreshold: parseFloat(
        settings.affiliateMinWithdrawalThreshold.toString(),
      ),
    };
  }
}

