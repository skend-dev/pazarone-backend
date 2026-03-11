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
        automaticPromotionEmailsEnabled: false,
        promotionEmailSchedule: 'daily',
        promotionEmailScheduleDayOfWeek: 1,
        promotionEmailsFlashDealsEnabled: true,
        promotionEmailsNewArrivalsEnabled: true,
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

  async getAutomaticPromotionEmailsEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.automaticPromotionEmailsEnabled === true;
  }

  async getPromotionEmailSchedule(): Promise<{ schedule: 'daily' | 'weekly'; dayOfWeek: number }> {
    const settings = await this.getSettings();
    const schedule = settings.promotionEmailSchedule === 'weekly' ? 'weekly' : 'daily';
    const dayOfWeek = settings.promotionEmailScheduleDayOfWeek ?? 1;
    return { schedule, dayOfWeek };
  }

  async getPromotionEmailsFlashDealsEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.promotionEmailsFlashDealsEnabled !== false;
  }

  async getPromotionEmailsNewArrivalsEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.promotionEmailsNewArrivalsEnabled !== false;
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

    if (updates.automaticPromotionEmailsEnabled !== undefined) {
      settings.automaticPromotionEmailsEnabled = updates.automaticPromotionEmailsEnabled;
    }

    if (updates.promotionEmailSchedule !== undefined) {
      settings.promotionEmailSchedule = updates.promotionEmailSchedule;
    }

    if (updates.promotionEmailScheduleDayOfWeek !== undefined) {
      settings.promotionEmailScheduleDayOfWeek = updates.promotionEmailScheduleDayOfWeek;
    }

    if (updates.promotionEmailsFlashDealsEnabled !== undefined) {
      settings.promotionEmailsFlashDealsEnabled = updates.promotionEmailsFlashDealsEnabled;
    }

    if (updates.promotionEmailsNewArrivalsEnabled !== undefined) {
      settings.promotionEmailsNewArrivalsEnabled = updates.promotionEmailsNewArrivalsEnabled;
    }

    if (updates.bankTransferDetails !== undefined) {
      settings.bankTransferDetails = updates.bankTransferDetails;
    }

    return await this.platformSettingsRepository.save(settings);
  }
}

