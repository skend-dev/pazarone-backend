import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerDashboardService } from './seller-dashboard.service';
import { SellerDashboardController } from './seller-dashboard.controller';
import { SellerAnalyticsService } from './seller-analytics.service';
import { SellerAnalyticsController } from './seller-analytics.controller';
import { SellerSettingsService } from './seller-settings.service';
import { SellerSettingsController } from './seller-settings.controller';
import { SellerPerformanceController } from './seller-performance.controller';
import { PublicSellerController } from './public-seller.controller';
import { TelegramNotificationService } from './telegram-notification.service';
import { SellerSettings } from './entities/seller-settings.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    PlatformModule,
    TypeOrmModule.forFeature([SellerSettings, Order, OrderItem, Product, User]),
  ],
  controllers: [
    SellerDashboardController,
    SellerAnalyticsController,
    SellerSettingsController,
    SellerPerformanceController,
    PublicSellerController,
  ],
  providers: [
    SellerDashboardService,
    SellerAnalyticsService,
    SellerSettingsService,
    TelegramNotificationService,
  ],
  exports: [SellerSettingsService, TelegramNotificationService],
})
export class SellerModule {}
