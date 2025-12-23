import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PublicOrdersController } from './public-orders.controller';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { SellerModule } from '../seller/seller.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { CustomerModule } from '../customer/customer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, User]),
    forwardRef(() => AffiliateModule),
    forwardRef(() => SellerModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => AuthModule),
    forwardRef(() => CustomerModule),
  ],
  controllers: [OrdersController, PublicOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
