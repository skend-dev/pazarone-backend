import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateService } from './affiliate.service';
import { AffiliateDashboardController } from './affiliate-dashboard.controller';
import { AffiliateAnalyticsController } from './affiliate-analytics.controller';
import { AffiliatePublicController } from './affiliate-public.controller';
import { AffiliateSettingsController } from './affiliate-settings.controller';
import { AffiliateWithdrawalsController } from './affiliate-withdrawals.controller';
import { AffiliateReferral } from './entities/affiliate-referral.entity';
import { AffiliateCommission } from './entities/affiliate-commission.entity';
import { AffiliateWithdrawal } from './entities/affiliate-withdrawal.entity';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    PlatformModule,
    TypeOrmModule.forFeature([
      AffiliateReferral,
      AffiliateCommission,
      AffiliateWithdrawal,
      User,
      Order,
    ]),
  ],
  controllers: [
    AffiliateDashboardController,
    AffiliateAnalyticsController,
    AffiliatePublicController,
    AffiliateSettingsController,
    AffiliateWithdrawalsController,
  ],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}

