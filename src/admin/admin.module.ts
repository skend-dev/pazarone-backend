import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { AffiliateReferral } from '../affiliate/entities/affiliate-referral.entity';
import { AffiliateCommission } from '../affiliate/entities/affiliate-commission.entity';
import { AffiliateWithdrawal } from '../affiliate/entities/affiliate-withdrawal.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminProductsController } from './admin-products.controller';
import { AdminAffiliatesService } from './admin-affiliates.service';
import { AdminAffiliatesController } from './admin-affiliates.controller';
import { AdminSellersService } from './admin-sellers.service';
import { AdminSellersController } from './admin-sellers.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { PlatformModule } from '../platform/platform.module';
import { SellerModule } from '../seller/seller.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    PlatformModule,
    SellerModule,
    forwardRef(() => NotificationsModule),
    TypeOrmModule.forFeature([
      User,
      Order,
      Product,
      AffiliateReferral,
      AffiliateCommission,
      AffiliateWithdrawal,
      SellerSettings,
    ]),
  ],
  controllers: [
    AdminUsersController,
    AdminOrdersController,
    AdminProductsController,
    AdminAffiliatesController,
    AdminSellersController,
    AdminDashboardController,
  ],
  providers: [
    AdminUsersService,
    AdminOrdersService,
    AdminProductsService,
    AdminAffiliatesService,
    AdminSellersService,
    AdminDashboardService,
  ],
  exports: [
    AdminUsersService,
    AdminOrdersService,
    AdminProductsService,
    AdminAffiliatesService,
    AdminSellersService,
    AdminDashboardService,
  ],
})
export class AdminModule {}
