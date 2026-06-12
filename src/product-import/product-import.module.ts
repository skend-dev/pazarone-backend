import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { ProductsModule } from '../products/products.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductImportService } from './product-import.service';
import { ProductImageHealthService } from './product-image-health.service';
import { ProductImageHealthSchedulerService } from './product-image-health-scheduler.service';
import { ProductImportController } from './product-import.controller';
import { AdminProductImportController } from './admin-product-import.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, User, Category]),
    forwardRef(() => ProductsModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ProductImportController, AdminProductImportController],
  providers: [
    ProductImportService,
    ProductImageHealthService,
    ProductImageHealthSchedulerService,
  ],
  exports: [ProductImportService, ProductImageHealthService],
})
export class ProductImportModule {}
