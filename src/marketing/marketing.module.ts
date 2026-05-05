import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingContact } from './entities/marketing-contact.entity';
import { MarketingInfobipDeliveryEvent } from './entities/marketing-infobip-delivery-event.entity';
import { MarketingInfobipInboundMessage } from './entities/marketing-infobip-inbound-message.entity';
import { User } from '../users/entities/user.entity';
import { CustomerNotificationPreferences } from '../customer/entities/customer-notification-preferences.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { MarketingContactSyncService } from './marketing-contact-sync.service';
import { MarketingContactService } from './marketing-contact.service';
import { MarketingImportService } from './marketing-import.service';
import { InfobipPeopleService } from './infobip-people.service';
import { MarketingInfobipContactPushService } from './marketing-infobip-contact-push.service';
import { AdminMarketingContactsController } from './admin-marketing-contacts.controller';
import { AdminInfobipActivityController } from './admin-infobip-activity.controller';
import { InfobipWebhookController } from './infobip-webhook.controller';
import { MarketingInfobipImportService } from './marketing-infobip-import.service';
import { MarketingInfobipWebhookService } from './marketing-infobip-webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketingContact,
      MarketingInfobipDeliveryEvent,
      MarketingInfobipInboundMessage,
      User,
      CustomerNotificationPreferences,
      SellerSettings,
    ]),
  ],
  controllers: [
    AdminMarketingContactsController,
    AdminInfobipActivityController,
    InfobipWebhookController,
  ],
  providers: [
    InfobipPeopleService,
    MarketingInfobipContactPushService,
    MarketingInfobipWebhookService,
    MarketingContactSyncService,
    MarketingContactService,
    MarketingImportService,
    MarketingInfobipImportService,
  ],
  exports: [
    MarketingContactSyncService,
    MarketingContactService,
    MarketingImportService,
  ],
})
export class MarketingModule {}
