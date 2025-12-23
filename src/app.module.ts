import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { SellerModule } from './seller/seller.module';
import { CategoriesModule } from './categories/categories.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { User } from './users/entities/user.entity';
import { Product } from './products/entities/product.entity';
import { Order } from './orders/entities/order.entity';
import { OrderItem } from './orders/entities/order-item.entity';
import { Category } from './categories/entities/category.entity';
import { SellerSettings } from './seller/entities/seller-settings.entity';
import { AffiliateModule } from './affiliate/affiliate.module';
import { AffiliateReferral } from './affiliate/entities/affiliate-referral.entity';
import { AffiliateCommission } from './affiliate/entities/affiliate-commission.entity';
import { AffiliateWithdrawal } from './affiliate/entities/affiliate-withdrawal.entity';
import { PlatformModule } from './platform/platform.module';
import { PlatformSettings } from './platform/entities/platform-settings.entity';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { Notification } from './notifications/entities/notification.entity';
import { EmailVerification } from './auth/entities/email-verification.entity';
import { CustomerModule } from './customer/customer.module';
import { CustomerAddress } from './customer/entities/customer-address.entity';
import { CustomerNotificationPreferences } from './customer/entities/customer-notification-preferences.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get<string>('DATABASE_USER'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        entities: [
          User,
          Product,
          Order,
          OrderItem,
          Category,
          SellerSettings,
          AffiliateReferral,
          AffiliateCommission,
          AffiliateWithdrawal,
          PlatformSettings,
          Notification,
          EmailVerification,
          CustomerAddress,
          CustomerNotificationPreferences,
        ],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    SellerModule,
    CategoriesModule,
    CloudinaryModule,
    AffiliateModule,
    PlatformModule,
    AdminModule,
    NotificationsModule,
    CustomerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
