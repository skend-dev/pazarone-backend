import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceSchedulerService } from './invoice-scheduler.service';
import { InvoiceController } from './invoice.controller';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { SellerSettings } from '../seller/entities/seller-settings.entity';
import { AffiliateCommission } from '../affiliate/entities/affiliate-commission.entity';
import { Product } from '../products/entities/product.entity';
import { SellerModule } from '../seller/seller.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      Order,
      User,
      SellerSettings,
      AffiliateCommission,
      Product,
    ]),
    SellerModule,
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceSchedulerService],
  exports: [InvoiceService],
})
export class InvoiceModule {}

