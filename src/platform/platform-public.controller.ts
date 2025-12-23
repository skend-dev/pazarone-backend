import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('platform-settings')
@Controller('platform-settings')
export class PlatformPublicController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get public platform settings',
    description: 'Returns public platform settings (minimum withdrawal threshold) - no authentication required',
  })
  @ApiResponse({
    status: 200,
    description: 'Public platform settings retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        affiliateMinWithdrawalThreshold: { type: 'number', example: 1000 },
      },
    },
  })
  async getPublicSettings() {
    const settings = await this.platformSettingsService.getSettings();
    return {
      affiliateMinWithdrawalThreshold: parseFloat(
        settings.affiliateMinWithdrawalThreshold.toString(),
      ),
    };
  }
}

