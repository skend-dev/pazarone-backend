import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, CategoryType } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
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
}

