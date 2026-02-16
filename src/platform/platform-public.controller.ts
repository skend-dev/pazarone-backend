import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettingsService } from './platform-settings.service';
import { User, UserType } from '../users/entities/user.entity';

@ApiTags('platform-settings')
@Controller('platform-settings')
export class PlatformPublicController {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get public platform settings',
    description: 'Returns public platform settings (minimum withdrawal threshold and bank transfer details) - no authentication required',
  })
  @ApiResponse({
    status: 200,
    description: 'Public platform settings retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        affiliateMinWithdrawalThreshold: { type: 'number', example: 1000 },
        platformFeePercent: { type: 'number', example: 7.0 },
        bankTransferDetails: {
          type: 'object',
          properties: {
            bankName: { type: 'string', example: 'Komercijalna Banka AD Skopje' },
            accountNumber: { type: 'string', example: '1234567890123' },
            accountHolder: { type: 'string', example: 'PazarOne DOOEL' },
            iban: { type: 'string', example: 'MK07250120000058984' },
            swift: { type: 'string', example: 'KOBSMK2X' },
            reference: { type: 'string', example: 'INV-{invoiceNumber}' },
          },
        },
      },
    },
  })
  async getPublicSettings() {
    const settings = await this.platformSettingsService.getSettings();
    return {
      affiliateMinWithdrawalThreshold: parseFloat(
        settings.affiliateMinWithdrawalThreshold.toString(),
      ),
      platformFeePercent: settings.platformFeePercent
        ? parseFloat(settings.platformFeePercent.toString())
        : undefined,
      bankTransferDetails: settings.bankTransferDetails || undefined,
    };
  }

  @Get('affiliate-commission-range')
  @ApiOperation({
    summary: 'Get affiliate commission range',
    description: 'Returns the minimum and maximum affiliate commission percentages and the number of affiliate users - no authentication required',
  })
  @ApiResponse({
    status: 200,
    description: 'Affiliate commission range retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        affiliateCommissionMin: { type: 'number', example: 0 },
        affiliateCommissionMax: { type: 'number', example: 100 },
        affiliatesCount: { type: 'number', example: 500 },
      },
    },
  })
  async getAffiliateCommissionRange() {
    const [settings, affiliatesCount] = await Promise.all([
      this.platformSettingsService.getSettings(),
      this.usersRepository.count({ where: { userType: UserType.AFFILIATE } }),
    ]);
    return {
      affiliateCommissionMin: parseFloat(
        settings.affiliateCommissionMin.toString(),
      ),
      affiliateCommissionMax: parseFloat(
        settings.affiliateCommissionMax.toString(),
      ),
      affiliatesCount,
    };
  }
}

