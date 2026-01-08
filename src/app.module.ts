// Import polyfills FIRST before TypeORM (which uses crypto)
import './polyfills';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validate } from './config/env.validation';
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
import { AffiliateReferralClick } from './affiliate/entities/affiliate-referral-click.entity';
import { AffiliateCommission } from './affiliate/entities/affiliate-commission.entity';
import { AffiliateWithdrawal } from './affiliate/entities/affiliate-withdrawal.entity';
import { AffiliatePaymentMethod } from './affiliate/entities/affiliate-payment-method.entity';
import { PaymentMethodOtp } from './affiliate/entities/payment-method-otp.entity';
import { PlatformModule } from './platform/platform.module';
import { PlatformSettings } from './platform/entities/platform-settings.entity';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { Notification } from './notifications/entities/notification.entity';
import { EmailVerification } from './auth/entities/email-verification.entity';
import { PasswordReset } from './auth/entities/password-reset.entity';
import { CustomerModule } from './customer/customer.module';
import { CustomerAddress } from './customer/entities/customer-address.entity';
import { CustomerNotificationPreferences } from './customer/entities/customer-notification-preferences.entity';
import { ProductVariantAttribute } from './products/entities/product-variant-attribute.entity';
import { ProductVariantValue } from './products/entities/product-variant-value.entity';
import { ProductVariant } from './products/entities/product-variant.entity';
import { InvoiceModule } from './invoice/invoice.module';
import { Invoice } from './invoice/entities/invoice.entity';
import { InvoiceItem } from './invoice/entities/invoice-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
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
          ProductVariantAttribute,
          ProductVariantValue,
          ProductVariant,
          Order,
          OrderItem,
          Category,
          SellerSettings,
          AffiliateReferral,
          AffiliateReferralClick,
          AffiliateCommission,
          AffiliateWithdrawal,
          AffiliatePaymentMethod,
          PaymentMethodOtp,
          PlatformSettings,
          Notification,
          EmailVerification,
          PasswordReset,
          CustomerAddress,
          CustomerNotificationPreferences,
          Invoice,
          InvoiceItem,
        ],
        synchronize: false, // Always false - use migrations in production
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
    InvoiceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
