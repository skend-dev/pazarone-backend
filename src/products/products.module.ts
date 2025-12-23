import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PublicProductsController } from './public-products.controller';
import { Product } from './entities/product.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, SellerSettings, User]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ProductsController, PublicProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
