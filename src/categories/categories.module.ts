import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { CategoriesSeedService } from './categories-seed.service';
import { Category } from './entities/category.entity';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Product])],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesSeedService],
  exports: [CategoriesService, CategoriesSeedService],
})
export class CategoriesModule {}

