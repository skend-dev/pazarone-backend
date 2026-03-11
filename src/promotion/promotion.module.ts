import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { CustomerNotificationPreferences } from '../customer/entities/customer-notification-preferences.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { AffiliateReferral } from '../affiliate/entities/affiliate-referral.entity';
import { Broadcast } from '../admin/entities/broadcast.entity';
import { ProductsModule } from '../products/products.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformModule } from '../platform/platform.module';
import { PromotionEmailService } from './promotion-email.service';
import { PromotionSchedulerService } from './promotion-scheduler.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      User,
      CustomerNotificationPreferences,
      SellerSettings,
      AffiliateReferral,
      Broadcast,
    ]),
    ProductsModule,
    AuthModule,
    PlatformModule,
  ],
  providers: [PromotionEmailService, PromotionSchedulerService],
  exports: [PromotionEmailService],
})
export class PromotionModule {}
