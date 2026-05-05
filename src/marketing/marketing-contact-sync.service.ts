import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserType } from '../users/entities/user.entity';
import { CustomerNotificationPreferences } from '../customer/entities/customer-notification-preferences.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import {
  MarketingContact,
  MarketingContactSource,
} from './entities/marketing-contact.entity';
import { normalizePhoneToE164 } from './utils/phone-normalize';
import { MarketingInfobipContactPushService } from './marketing-infobip-contact-push.service';

/**
 * Live sync from platform users: **customers only** get a `marketing_contacts` row.
 * Admins and non-customers are removed from the audience table (by `userId`).
 *
 * CSV / Infobip imports are unchanged. Imports default viber opt-in false; syncing from User never flips Viber consent.
 */
@Injectable()
export class MarketingContactSyncService {
  private readonly logger = new Logger(MarketingContactSyncService.name);

  constructor(
    @InjectRepository(MarketingContact)
    private readonly marketingContactRepository: Repository<MarketingContact>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CustomerNotificationPreferences)
    private readonly customerPrefsRepository: Repository<CustomerNotificationPreferences>,
    @InjectRepository(SellerSettings)
    private readonly sellerSettingsRepository: Repository<SellerSettings>,
    private readonly infobipContactPush: MarketingInfobipContactPushService,
  ) {}

  /**
   * Idempotent upsert from a platform user. Swallows errors so auth flows are not blocked.
   */
  async upsertFromUserId(userId: string): Promise<void> {
    try {
      await this.tryUpsertFromUserId(userId);
    } catch (err) {
      this.logger.warn(
        `Marketing sync failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async tryUpsertFromUserId(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return;
    }

    if (user.userType === UserType.ADMIN) {
      await this.marketingContactRepository.delete({ userId: user.id });
      return;
    }

    if (user.userType !== UserType.CUSTOMER) {
      await this.marketingContactRepository.delete({ userId: user.id });
      return;
    }

    const emailNorm =
      user.email && user.email.trim() !== ''
        ? user.email.trim().toLowerCase()
        : null;
    const phoneE164 = normalizePhoneToE164(user.phone);

    let contact =
      (await this.marketingContactRepository.findOne({
        where: { userId: user.id },
      })) ?? null;

    if (!contact && emailNorm) {
      contact = await this.marketingContactRepository.findOne({
        where: { email: emailNorm },
      });
    }

    if (!contact && phoneE164) {
      contact = await this.marketingContactRepository.findOne({
        where: { phoneE164 },
      });
    }

    const prevViberOpt = contact?.viberMarketingOptIn ?? false;
    const prevViberSuppressed = contact?.viberSuppressedAt ?? null;

    const emailMarketingOptIn = await this.resolveEmailMarketingOptIn(user);

    const entity =
      contact ??
      this.marketingContactRepository.create({
        userId: user.id,
        source: MarketingContactSource.REGISTERED,
        viberMarketingOptIn: false,
        emailMarketingOptIn: false,
      });

    entity.userId = user.id;
    entity.source = MarketingContactSource.REGISTERED;
    entity.email = emailNorm;
    entity.phoneE164 = phoneE164;
    entity.name = user.name ?? null;
    entity.market = user.market ?? null;
    entity.userType = user.userType;
    entity.emailMarketingOptIn = emailMarketingOptIn;
    entity.viberMarketingOptIn = prevViberOpt;
    entity.viberSuppressedAt = prevViberSuppressed;

    if (emailMarketingOptIn) {
      entity.emailSuppressedAt = null;
    } else {
      entity.emailSuppressedAt = entity.emailSuppressedAt ?? new Date();
    }

    const saved = await this.marketingContactRepository.save(entity);

    try {
      await this.infobipContactPush.pushIfPhonePresent(saved);
    } catch (err) {
      this.logger.warn(
        `Infobip People push after user sync failed (${user.id}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Used by PromotionEmailService refactor / tests — same rules as sync. */
  async resolveEmailMarketingOptIn(user: User): Promise<boolean> {
    switch (user.userType) {
      case UserType.ADMIN:
        return false;
      case UserType.AFFILIATE:
        return true;
      case UserType.CUSTOMER: {
        const prefs = await this.customerPrefsRepository.findOne({
          where: { customerId: user.id },
        });
        return prefs == null || prefs.promotionalEmails;
      }
      case UserType.SELLER: {
        const ss = await this.sellerSettingsRepository.findOne({
          where: { sellerId: user.id },
        });
        return ss != null && ss.notificationsPromotions;
      }
      default:
        return false;
    }
  }
}
