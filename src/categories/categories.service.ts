import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, CategoryType } from './entities/category.entity';
import { Product, ProductStatus } from '../products/entities/product.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<{
    primaryCategories: Category[];
    secondaryCategories: Category[];
  }> {
    const categories = await this.categoriesRepository.find({
      relations: ['subcategories'],
      order: { name: 'ASC' },
    });

    const primaryCategories = categories.filter(
      (cat) => cat.type === CategoryType.PRIMARY,
    );
    const secondaryCategories = categories.filter(
      (cat) => cat.type === CategoryType.SECONDARY,
    );

    return {
      primaryCategories,
      secondaryCategories,
    };
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['subcategories'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findAllFlat(): Promise<{ categories: Category[] }> {
    const categories = await this.categoriesRepository.find({
      order: { name: 'ASC' },
    });
    return { categories };
  }

  /**
   * Returns categories with product counts, ordered by count descending.
   * Used by landing page and marketplace category quick entry.
   */
  async findPopular(limit: number = 10): Promise<{
    categories: Array<Category & { productsCount: number }>;
  }> {
    const raw = await this.categoriesRepository
      .createQueryBuilder('c')
      .leftJoin(
        Product,
        'p',
        'p.categoryId = c.id AND p.status = :status AND p.approved = :approved',
        { status: ProductStatus.ACTIVE, approved: true },
      )
      .addSelect('COUNT(p.id)', 'productscount')
      .groupBy('c.id')
      .addGroupBy('c.name')
      .addGroupBy('c.slug')
      .addGroupBy('c.icon')
      .addGroupBy('c.type')
      .addGroupBy('c.parentId')
      .addGroupBy('c.translations')
      .addGroupBy('c.createdAt')
      .addGroupBy('c.updatedAt')
      .orderBy('productscount', 'DESC')
      .addOrderBy('c.name', 'ASC')
      .limit(limit)
      .getRawAndEntities();

    const categories = raw.entities.map((entity, i) => {
      const row = raw.raw[i] ?? {};
      const count = row.productscount ?? 0;
      return {
        ...entity,
        productsCount: typeof count === 'number' ? count : parseInt(String(count), 10) || 0,
      };
    });

    return { categories };
  }
}

