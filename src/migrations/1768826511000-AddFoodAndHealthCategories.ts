import { MigrationInterface, QueryRunner } from 'typeorm';
import { CategoryType } from '../categories/entities/category.entity';

export class AddFoodAndHealthCategories1768826511000
  implements MigrationInterface
{
  name = 'AddFoodAndHealthCategories1768826511000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // New categories to add
    const newCategories = [
      // Primary category
      {
        name: 'Food & Natural Products',
        slug: 'food-natural',
        icon: 'food',
        type: CategoryType.PRIMARY,
        parentSlug: null,
        translations: {
          mk: 'Храна и природни производи',
          sq: 'Ushqime dhe produkte natyrore',
          tr: 'Gıda ve Doğal Ürünler',
        },
      },
      // Secondary category
      {
        name: 'Health & Wellness',
        slug: 'health-wellness',
        icon: 'wellness',
        type: CategoryType.SECONDARY,
        parentSlug: null,
        translations: {
          mk: 'Здравје и благосостојба',
          sq: 'Shëndet dhe mirëqenie',
          tr: 'Sağlık ve Zindelik',
        },
      },
      // Subcategories under Food & Natural Products
      {
        name: 'Honey & Bee Products',
        slug: 'honey-bee',
        icon: 'honey',
        type: CategoryType.SUBCATEGORY,
        parentSlug: 'food-natural',
        translations: {
          mk: 'Мед и пчелни производи',
          sq: 'Mjaltë dhe produkte bletësh',
          tr: 'Bal ve Arı Ürünleri',
        },
      },
      {
        name: 'Spices & Superfoods',
        slug: 'spices-superfoods',
        icon: 'spices',
        type: CategoryType.SUBCATEGORY,
        parentSlug: 'food-natural',
        translations: {
          mk: 'Зачини и супер храна',
          sq: 'Erëza dhe superushqime',
          tr: 'Baharatlar ve Süper Gıdalar',
        },
      },
      {
        name: 'Organic Products',
        slug: 'organic-products',
        icon: 'organic',
        type: CategoryType.SUBCATEGORY,
        parentSlug: 'food-natural',
        translations: {
          mk: 'Органски производи',
          sq: 'Produkte organike',
          tr: 'Organik Ürünler',
        },
      },
      // Subcategories under Health & Wellness
      {
        name: 'Immunity Support',
        slug: 'immunity-support',
        icon: 'immunity',
        type: CategoryType.SUBCATEGORY,
        parentSlug: 'health-wellness',
        translations: {
          mk: 'Поддршка на имунитет',
          sq: 'Mbështetje e imunitetit',
          tr: 'Bağışıklık Desteği',
        },
      },
      {
        name: 'Energy & Vitality',
        slug: 'energy-vitality',
        icon: 'energy',
        type: CategoryType.SUBCATEGORY,
        parentSlug: 'health-wellness',
        translations: {
          mk: 'Енергија и виталност',
          sq: 'Energji dhe vitalitet',
          tr: 'Enerji ve Canlılık',
        },
      },
      {
        name: 'Natural Remedies',
        slug: 'natural-remedies',
        icon: 'leaf',
        type: CategoryType.SUBCATEGORY,
        parentSlug: 'health-wellness',
        translations: {
          mk: 'Природни решенија',
          sq: 'Zgjidhje natyrore',
          tr: 'Doğal Çözümler',
        },
      },
    ];

    // Create a map to store category IDs by slug
    const categoryMap = new Map<string, string>();

    // Step 1: Create primary and secondary categories (no parent)
    const topLevelCategories = newCategories.filter(
      (cat) => cat.parentSlug === null,
    );

    for (const catData of topLevelCategories) {
      // Check if category already exists
      const existing = await queryRunner.manager.query(
        `SELECT id FROM categories WHERE slug = $1`,
        [catData.slug],
      );

      if (existing.length === 0) {
        const result = await queryRunner.manager.query(
          `INSERT INTO categories (id, name, slug, icon, type, "parentId", translations, "createdAt", "updatedAt") 
           VALUES (uuid_generate_v4(), $1, $2, $3, $4, NULL, $5, now(), now()) 
           RETURNING id, slug`,
          [
            catData.name,
            catData.slug,
            catData.icon,
            catData.type,
            catData.translations ? JSON.stringify(catData.translations) : null,
          ],
        );
        categoryMap.set(result[0].slug, result[0].id);
        console.log(`✓ Created ${catData.type} category: ${catData.name}`);
      } else {
        categoryMap.set(catData.slug, existing[0].id);
        console.log(
          `⏭️  Category '${catData.name}' already exists. Skipping.`,
        );
      }
    }

    // Step 2: Create subcategories (with parent)
    const subcategories = newCategories.filter(
      (cat) => cat.parentSlug !== null,
    );

    for (const catData of subcategories) {
      // Check if category already exists
      const existing = await queryRunner.manager.query(
        `SELECT id FROM categories WHERE slug = $1`,
        [catData.slug],
      );

      if (existing.length > 0) {
        console.log(
          `⏭️  Subcategory '${catData.name}' already exists. Skipping.`,
        );
        continue;
      }

      // Get parent ID
      const parentId = categoryMap.get(catData.parentSlug!);
      if (!parentId) {
        console.warn(
          `⚠️  Parent '${catData.parentSlug}' not found for subcategory '${catData.name}'. Skipping.`,
        );
        continue;
      }

      await queryRunner.manager.query(
        `INSERT INTO categories (id, name, slug, icon, type, "parentId", translations, "createdAt", "updatedAt") 
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), now())`,
        [
          catData.name,
          catData.slug,
          catData.icon,
          catData.type,
          parentId,
          catData.translations ? JSON.stringify(catData.translations) : null,
        ],
      );
      console.log(`✓ Created subcategory: ${catData.name}`);
    }

    console.log('✅ Food & Health categories migration completed!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove categories in reverse order (subcategories first, then parents)
    const slugsToRemove = [
      // Subcategories
      'honey-bee',
      'spices-superfoods',
      'organic-products',
      'immunity-support',
      'energy-vitality',
      'natural-remedies',
      // Top-level categories
      'food-natural',
      'health-wellness',
    ];

    for (const slug of slugsToRemove) {
      await queryRunner.manager.query(
        `DELETE FROM categories WHERE slug = $1`,
        [slug],
      );
      console.log(`✓ Removed category with slug: ${slug}`);
    }

    console.log('✅ Food & Health categories rollback completed!');
  }
}
