import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../../users/users.service';
import { UserType } from '../../users/entities/user.entity';
import { CustomerNotificationPreferences } from '../../customer/entities/customer-notification-preferences.entity';
import { SellerSettings } from '../../seller/entities/seller-settings.entity';

@Injectable()
export class UnsubscribeService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(CustomerNotificationPreferences)
    private readonly notificationPreferencesRepository: Repository<CustomerNotificationPreferences>,
    @InjectRepository(SellerSettings)
    private readonly sellerSettingsRepository: Repository<SellerSettings>,
  ) {}

  /**
   * Opt out the user with the given email from promotional emails.
   * Updates CustomerNotificationPreferences for customers and SellerSettings for sellers.
   * No-op for affiliates (no preference yet) and admins.
   */
  async unsubscribe(email: string): Promise<{ unsubscribed: boolean }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Don't reveal whether the email exists - return success anyway for privacy
      return { unsubscribed: true };
    }

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
    }

    if (user.userType === UserType.SELLER) {
      const settings = await this.sellerSettingsRepository.findOne({
        where: { sellerId: user.id },
      });
      if (settings) {
        settings.notificationsPromotions = false;
        await this.sellerSettingsRepository.save(settings);
      }
    }

    // Affiliate: no preference yet; admin: no-op
    return { unsubscribed: true };
  }
}
