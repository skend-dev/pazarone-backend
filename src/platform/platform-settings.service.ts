import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from './entities/platform-settings.entity';

@Injectable()
export class PlatformSettingsService {
  private readonly DEFAULT_KEY = 'main';

  constructor(
    @InjectRepository(PlatformSettings)
    private platformSettingsRepository: Repository<PlatformSettings>,
  ) {}

  // Get or create platform settings
  async getSettings(): Promise<PlatformSettings> {
    let settings = await this.platformSettingsRepository.findOne({
      where: { key: this.DEFAULT_KEY },
    });

    if (!settings) {
      // Create default settings
      settings = this.platformSettingsRepository.create({
        key: this.DEFAULT_KEY,
        affiliateMinWithdrawalThreshold: 1000,
        affiliateCommissionMin: 0,
        affiliateCommissionMax: 100,
        platformFeePercent: 7.0,
      });
      settings = await this.platformSettingsRepository.save(settings);
    }

    return settings;
  }

  // Get minimum withdrawal threshold
  async getMinimumWithdrawalThreshold(): Promise<number> {
    const settings = await this.getSettings();
    return parseFloat(settings.affiliateMinWithdrawalThreshold.toString());
  }

  // Get platform fee percentage
  async getPlatformFeePercent(): Promise<number> {
    const settings = await this.getSettings();
    return parseFloat(settings.platformFeePercent.toString());
  }

  // Get affiliate commission min and max
  async getAffiliateCommissionMin(): Promise<number> {
    const settings = await this.getSettings();
    return parseFloat(settings.affiliateCommissionMin.toString());
  }

  async getAffiliateCommissionMax(): Promise<number> {
    const settings = await this.getSettings();
    return parseFloat(settings.affiliateCommissionMax.toString());
  }

  // Update platform settings
  async updateSettings(updates: Partial<PlatformSettings>): Promise<PlatformSettings> {
    const settings = await this.getSettings();

    if (updates.affiliateMinWithdrawalThreshold !== undefined) {
      settings.affiliateMinWithdrawalThreshold = updates.affiliateMinWithdrawalThreshold;
    }

    if (updates.affiliateCommissionMin !== undefined) {
      settings.affiliateCommissionMin = updates.affiliateCommissionMin;
    }

    if (updates.affiliateCommissionMax !== undefined) {
      settings.affiliateCommissionMax = updates.affiliateCommissionMax;
    }

    if (updates.platformFeePercent !== undefined) {
      settings.platformFeePercent = updates.platformFeePercent;
    }

    if (updates.bankTransferDetails !== undefined) {
      settings.bankTransferDetails = updates.bankTransferDetails;
    }

    return await this.platformSettingsRepository.save(settings);
  }
}

