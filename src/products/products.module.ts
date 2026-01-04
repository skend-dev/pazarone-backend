import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PublicProductsController } from './public-products.controller';
import { Product } from './entities/product.entity';
import { ProductVariantAttribute } from './entities/product-variant-attribute.entity';
import { ProductVariantValue } from './entities/product-variant-value.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { CurrencyModule } from '../common/currency/currency.module';
import { OrderItem } from '../orders/entities/order-item.entity';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductVariantAttribute,
      ProductVariantValue,
      ProductVariant,
      OrderItem,
      SellerSettings,
      User,
    ]),
    forwardRef(() => NotificationsModule),
    CurrencyModule,
    PlatformModule,
  ],
  controllers: [ProductsController, PublicProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
