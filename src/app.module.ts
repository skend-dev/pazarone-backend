// Import polyfills FIRST before TypeORM (which uses crypto)
import './polyfills';

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
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
import { Broadcast } from './admin/entities/broadcast.entity';
import { BroadcastRecipient } from './admin/entities/broadcast-recipient.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { Notification } from './notifications/entities/notification.entity';
import { EmailVerification } from './auth/entities/email-verification.entity';
import { PasswordReset } from './auth/entities/password-reset.entity';
import { CustomerModule } from './customer/customer.module';
import { PromotionModule } from './promotion/promotion.module';
import { CustomerAddress } from './customer/entities/customer-address.entity';
import { CustomerNotificationPreferences } from './customer/entities/customer-notification-preferences.entity';
import { ProductVariantAttribute } from './products/entities/product-variant-attribute.entity';
import { ProductVariantValue } from './products/entities/product-variant-value.entity';
import { ProductVariant } from './products/entities/product-variant.entity';
import { InvoiceModule } from './invoice/invoice.module';
import { Invoice } from './invoice/entities/invoice.entity';
import { InvoiceItem } from './invoice/entities/invoice-item.entity';
import { FirebaseAdminModule } from './firebase/firebase-admin.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { UserIdentity } from './users/entities/user-identity.entity';
import { MarketingModule } from './marketing/marketing.module';
import { ProductImportModule } from './product-import/product-import.module';
import {
  ProductImageSubscriber,
  ProductVariantImageSubscriber,
} from './products/product-image.subscriber';
import { MarketingContact } from './marketing/entities/marketing-contact.entity';
import { MarketingInfobipDeliveryEvent } from './marketing/entities/marketing-infobip-delivery-event.entity';
import { MarketingInfobipInboundMessage } from './marketing/entities/marketing-infobip-inbound-message.entity';

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
        ssl:
          configService.get<string>('DATABASE_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : undefined,
        entities: [
          User,
          UserIdentity,
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
          Broadcast,
          BroadcastRecipient,
          MarketingContact,
          MarketingInfobipDeliveryEvent,
          MarketingInfobipInboundMessage,
        ],
        subscribers: [ProductImageSubscriber, ProductVariantImageSubscriber],
        synchronize: false, // Always false - use migrations in production
        // Only log errors in development, disable query logging for cleaner output
        logging:
          configService.get<string>('NODE_ENV') === 'development'
            ? ['error', 'warn']
            : false,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 30,
      },
    ]),
    ScheduleModule.forRoot(),
    FirebaseAdminModule,
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
    PromotionModule,
    MarketingModule,
    ProductImportModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
