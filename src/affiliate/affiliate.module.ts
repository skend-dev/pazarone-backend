import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateService } from './affiliate.service';
import { AffiliateDashboardController } from './affiliate-dashboard.controller';
import { AffiliateAnalyticsController } from './affiliate-analytics.controller';
import { AffiliatePublicController } from './affiliate-public.controller';
import { AffiliateSettingsController } from './affiliate-settings.controller';
import { AffiliateWithdrawalsController } from './affiliate-withdrawals.controller';
import { AffiliateReferral } from './entities/affiliate-referral.entity';
import { AffiliateReferralClick } from './entities/affiliate-referral-click.entity';
import { AffiliateCommission } from './entities/affiliate-commission.entity';
import { AffiliateWithdrawal } from './entities/affiliate-withdrawal.entity';
import { AffiliatePaymentMethod } from './entities/affiliate-payment-method.entity';
import { PaymentMethodOtp } from './entities/payment-method-otp.entity';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { PlatformModule } from '../platform/platform.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PlatformModule,
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      AffiliateReferral,
      AffiliateReferralClick,
      AffiliateCommission,
      AffiliateWithdrawal,
      AffiliatePaymentMethod,
      PaymentMethodOtp,
      User,
      Order,
      Product,
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
