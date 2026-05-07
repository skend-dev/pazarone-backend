import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../../users/users.service';
import { UserType } from '../../users/entities/user.entity';
import { CustomerNotificationPreferences } from '../../customer/entities/customer-notification-preferences.entity';
import { SellerSettings } from '../../seller/entities/seller-settings.entity';
import { MarketingContactSyncService } from '../../marketing/marketing-contact-sync.service';
import { MarketingContact } from '../../marketing/entities/marketing-contact.entity';

@Injectable()
export class UnsubscribeService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(CustomerNotificationPreferences)
    private readonly notificationPreferencesRepository: Repository<CustomerNotificationPreferences>,
    @InjectRepository(SellerSettings)
    private readonly sellerSettingsRepository: Repository<SellerSettings>,
    @InjectRepository(MarketingContact)
    private readonly marketingContactRepository: Repository<MarketingContact>,
    private readonly marketingContactSyncService: MarketingContactSyncService,
  ) {}

  /**
   * Opt out the given email from all promotional/marketing sends.
   *
   * For customers: disables promotionalEmails preference and syncs the
   * MarketingContact row via the sync service.
   * For sellers: disables notificationsPromotions and syncs similarly.
   * For affiliates and unknown emails (non-registered contacts): no user
   * preference to update, but we still suppress the MarketingContact row
   * directly so they are excluded from future broadcast audience queries.
   */
  async unsubscribe(email: string): Promise<{ unsubscribed: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.usersService.findByEmail(email);

    if (user) {
      if (user.userType === UserType.CUSTOMER) {
        let prefs = await this.notificationPreferencesRepository.findOne({
          where: { customerId: user.id },
        });
        if (!prefs) {
          prefs = this.notificationPreferencesRepository.create({
            customerId: user.id,
            orderUpdates: true,
            promotionalEmails: false,
            productRecommendations: false,
          });
        } else {
          prefs.promotionalEmails = false;
        }
        await this.notificationPreferencesRepository.save(prefs);
        await this.marketingContactSyncService.upsertFromUserId(user.id);
      }

      if (user.userType === UserType.SELLER) {
        const settings = await this.sellerSettingsRepository.findOne({
          where: { sellerId: user.id },
        });
        if (settings) {
          settings.notificationsPromotions = false;
          await this.sellerSettingsRepository.save(settings);
          await this.marketingContactSyncService.upsertFromUserId(user.id);
        }
      }
    }

    // Suppress the MarketingContact row for every unsubscribe request,
    // regardless of user type. This handles affiliates, non-registered
    // imported/manual/Infobip contacts, and acts as a safe fallback for
    // customers and sellers (idempotent — the sync service may already
    // have set emailSuppressedAt).
    const contact = await this.marketingContactRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (contact && !contact.emailSuppressedAt) {
      contact.emailSuppressedAt = new Date();
      await this.marketingContactRepository.save(contact);
    }

    return { unsubscribed: true };
  }
}
