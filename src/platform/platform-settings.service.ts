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
        promotionEmailScheduleDays: null,
        promotionEmailScheduleSlots: null,
        promotionEmailsFlashDealsEnabled: true,
        promotionEmailsNewArrivalsEnabled: true,
        promotionEmailSendHour: 9,
        promotionEmailMaxProducts: 8,
        promotionEmailTargetCustomers: true,
        promotionEmailTargetSellers: true,
        promotionEmailTargetAffiliates: true,
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

  async getPromotionEmailSchedule(): Promise<{
    schedule: 'daily' | 'weekly' | 'custom';
    dayOfWeek: number;
    scheduleSlots: { day: number; hour: number }[];
  }> {
    const settings = await this.getSettings();
    const raw = settings.promotionEmailSchedule;
    const schedule: 'daily' | 'weekly' | 'custom' =
      raw === 'weekly' ? 'weekly' : raw === 'custom' ? 'custom' : 'daily';
    const dayOfWeek = settings.promotionEmailScheduleDayOfWeek ?? 1;

    // Prefer the new slots; fall back to legacy scheduleDays with default hour
    let scheduleSlots: { day: number; hour: number }[] = [];
    if (Array.isArray(settings.promotionEmailScheduleSlots) && settings.promotionEmailScheduleSlots.length > 0) {
      scheduleSlots = settings.promotionEmailScheduleSlots;
    } else if (Array.isArray(settings.promotionEmailScheduleDays) && settings.promotionEmailScheduleDays.length > 0) {
      const defaultHour = settings.promotionEmailSendHour ?? 9;
      scheduleSlots = settings.promotionEmailScheduleDays.map((day) => ({ day, hour: defaultHour }));
    }

    return { schedule, dayOfWeek, scheduleSlots };
  }

  async getPromotionEmailsFlashDealsEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.promotionEmailsFlashDealsEnabled !== false;
  }

  async getPromotionEmailsNewArrivalsEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.promotionEmailsNewArrivalsEnabled !== false;
  }

  async getPromotionEmailSendHour(): Promise<number> {
    const settings = await this.getSettings();
    return settings.promotionEmailSendHour ?? 9;
  }

  async getPromotionEmailMaxProducts(): Promise<number> {
    const settings = await this.getSettings();
    const val = settings.promotionEmailMaxProducts ?? 8;
    return Math.max(1, Math.min(20, val));
  }

  async getPromotionEmailAudience(): Promise<{
    customers: boolean;
    sellers: boolean;
    affiliates: boolean;
  }> {
    const settings = await this.getSettings();
    return {
      customers: settings.promotionEmailTargetCustomers !== false,
      sellers: settings.promotionEmailTargetSellers !== false,
      affiliates: settings.promotionEmailTargetAffiliates !== false,
    };
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

    if (updates.promotionEmailScheduleDays !== undefined) {
      if (updates.promotionEmailScheduleDays === null) {
        settings.promotionEmailScheduleDays = null;
      } else {
        const valid = [...new Set(updates.promotionEmailScheduleDays)]
          .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
          .sort((a, b) => a - b);
        settings.promotionEmailScheduleDays = valid.length > 0 ? valid : null;
      }
    }

    if (updates.promotionEmailScheduleSlots !== undefined) {
      if (updates.promotionEmailScheduleSlots === null || !updates.promotionEmailScheduleSlots?.length) {
        settings.promotionEmailScheduleSlots = null;
      } else {
        // Deduplicate by day (last one wins), validate ranges
        const byDay = new Map<number, { day: number; hour: number }>();
        for (const slot of updates.promotionEmailScheduleSlots) {
          const day = Math.round(slot.day);
          const hour = Math.round(slot.hour);
          if (day >= 0 && day <= 6 && hour >= 0 && hour <= 23) {
            byDay.set(day, { day, hour });
          }
        }
        const sorted = [...byDay.values()].sort((a, b) => a.day - b.day);
        settings.promotionEmailScheduleSlots = sorted.length > 0 ? sorted : null;
      }
    }

    if (updates.promotionEmailsFlashDealsEnabled !== undefined) {
      settings.promotionEmailsFlashDealsEnabled = updates.promotionEmailsFlashDealsEnabled;
    }

    if (updates.promotionEmailsNewArrivalsEnabled !== undefined) {
      settings.promotionEmailsNewArrivalsEnabled = updates.promotionEmailsNewArrivalsEnabled;
    }

    if (updates.promotionEmailSendHour !== undefined) {
      settings.promotionEmailSendHour = Math.max(0, Math.min(23, updates.promotionEmailSendHour));
    }

    if (updates.promotionEmailMaxProducts !== undefined) {
      settings.promotionEmailMaxProducts = Math.max(1, Math.min(20, updates.promotionEmailMaxProducts));
    }

    if (updates.promotionEmailTargetCustomers !== undefined) {
      settings.promotionEmailTargetCustomers = updates.promotionEmailTargetCustomers;
    }

    if (updates.promotionEmailTargetSellers !== undefined) {
      settings.promotionEmailTargetSellers = updates.promotionEmailTargetSellers;
    }

    if (updates.promotionEmailTargetAffiliates !== undefined) {
      settings.promotionEmailTargetAffiliates = updates.promotionEmailTargetAffiliates;
    }

    if (updates.bankTransferDetails !== undefined) {
      settings.bankTransferDetails = updates.bankTransferDetails;
    }

    return await this.platformSettingsRepository.save(settings);
  }
}

