import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, CategoryType } from './entities/category.entity';
import { categorySeedData } from './categories.seed';

@Injectable()
export class CategoriesSeedService {
  private readonly logger = new Logger(CategoriesSeedService.name);

  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
  ) {}

  async seed() {
    this.logger.log('Starting category seeding...');

    try {
      // Check if categories already exist
      const existingCount = await this.categoriesRepository.count();
      if (existingCount > 0) {
        this.logger.warn(
          `Categories already exist (${existingCount} found). Skipping seed.`,
        );
        this.logger.log(
          'To re-seed, delete existing categories first or clear the database.',
        );
        return;
      }

      // Create a map to store created categories by slug for easy lookup
      const categoryMap = new Map<string, Category>();

      // Step 1: Create primary categories (no parent)
      const primaryCategories = categorySeedData.filter(
        (cat) => cat.type === CategoryType.PRIMARY,
      );

      for (const catData of primaryCategories) {
        const category = this.categoriesRepository.create({
          name: catData.name,
          slug: catData.slug,
          icon: catData.icon,
          type: catData.type,
          parentId: null,
        });
        const saved = await this.categoriesRepository.save(category);
        categoryMap.set(saved.slug, saved);
        this.logger.log(`✓ Created primary category: ${saved.name}`);
      }

      // Step 2: Create secondary categories (standalone, no parent)
      const secondaryCategories = categorySeedData.filter(
        (cat) => cat.type === CategoryType.SECONDARY,
      );

      for (const catData of secondaryCategories) {
        // Secondary categories can be standalone (parentSlug: null) or have a parent
        const parent = catData.parentSlug
          ? categoryMap.get(catData.parentSlug)
          : null;

        if (catData.parentSlug && !parent) {
          this.logger.warn(
            `Parent '${catData.parentSlug}' not found for secondary category '${catData.name}'. Skipping.`,
          );
          continue;
        }

        const category = this.categoriesRepository.create({
          name: catData.name,
          slug: catData.slug,
          icon: catData.icon,
          type: catData.type,
          parentId: parent?.id || null,
        });
        const saved = await this.categoriesRepository.save(category);
        categoryMap.set(saved.slug, saved);
        this.logger.log(
          `✓ Created secondary category: ${saved.name}${parent ? ` (parent: ${parent.name})` : ''}`,
        );
      }

      // Step 3: Create subcategories (parent is secondary or primary)
      const subcategories = categorySeedData.filter(
        (cat) => cat.type === CategoryType.SUBCATEGORY,
      );

      for (const catData of subcategories) {
        if (!catData.parentSlug) {
          this.logger.warn(
            `Subcategory '${catData.name}' missing parentSlug. Skipping.`,
          );
          continue;
        }

        const parent = categoryMap.get(catData.parentSlug);
        if (!parent) {
          this.logger.warn(
            `Parent '${catData.parentSlug}' not found for subcategory '${catData.name}'. Skipping.`,
          );
          continue;
        }

        const category = this.categoriesRepository.create({
          name: catData.name,
          slug: catData.slug,
          icon: catData.icon,
          type: catData.type,
          parentId: parent.id,
        });
        const saved = await this.categoriesRepository.save(category);
        categoryMap.set(saved.slug, saved);
        this.logger.log(
          `✓ Created subcategory: ${saved.name} (parent: ${parent.name})`,
        );
      }

      const totalCreated = categoryMap.size;
      this.logger.log(
        `✅ Category seeding completed successfully! Created ${totalCreated} categories.`,
      );
    } catch (error) {
      this.logger.error('Error seeding categories:', error);
      throw error;
    }
  }

  /**
   * Clear all categories (use with caution!)
   */
  async clear() {
    this.logger.warn('Clearing all categories...');
    await this.categoriesRepository.delete({});
    this.logger.log('All categories cleared.');
  }
}
