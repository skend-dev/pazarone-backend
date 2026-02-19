import { MigrationInterface, QueryRunner } from 'typeorm';
import { CategoryType } from '../categories/entities/category.entity';

/**
 * Adds "Phones & Mobile Devices" primary category and subcategories (Smartphones, Tablets).
 * Safe for production: idempotent (skips insert if slug already exists), additive only.
 */
export class AddPhonesCategory1769900000000 implements MigrationInterface {
  name = 'AddPhonesCategory1769900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const newCategories = [
      {
        name: 'Phones & Mobile Devices',
        slug: 'phones',
        icon: 'phone',
        type: CategoryType.PRIMARY,
        parentSlug: null as string | null,
        translations: {
          mk: 'Телефони и мобилни уреди',
          sq: 'Telefona dhe pajisje mobile',
          tr: 'Telefonlar ve Mobil Cihazlar',
        },
      },
      {
        name: 'Smartphones',
        slug: 'smartphones',
        icon: 'phone',
        type: CategoryType.SUBCATEGORY,
        parentSlug: 'phones',
        translations: {
          mk: 'Паметни телефони',
          sq: 'Smartphone',
          tr: 'Akıllı Telefonlar',
        },
      },
      {
        name: 'Tablets',
        slug: 'tablets',
        icon: 'tablet',
        type: CategoryType.SUBCATEGORY,
        parentSlug: 'phones',
        translations: {
          mk: 'Таблети',
          sq: 'Tableta',
          tr: 'Tabletler',
        },
      },
    ];

    const categoryMap = new Map<string, string>();

    // Idempotent: skip insert if slug already exists (e.g. re-run or already seeded)
    const topLevel = newCategories.filter((c) => c.parentSlug === null);
    for (const catData of topLevel) {
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
      } else {
        categoryMap.set(catData.slug, existing[0].id);
      }
    }

    const subcategories = newCategories.filter((c) => c.parentSlug !== null);
    for (const catData of subcategories) {
      const existing = await queryRunner.manager.query(
        `SELECT id FROM categories WHERE slug = $1`,
        [catData.slug],
      );
      if (existing.length > 0) continue;

      const parentId = categoryMap.get(catData.parentSlug!);
      if (!parentId) continue;

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
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Clear product references first to avoid FK violation on categories.id
    await queryRunner.manager.query(
      `UPDATE products SET "categoryId" = NULL WHERE "categoryId" IN (SELECT id FROM categories WHERE slug IN ('smartphones', 'tablets', 'phones'))`,
    );
    // Delete subcategories first, then parent (categories.parentId self-FK)
    const slugsToRemove = ['smartphones', 'tablets', 'phones'];
    for (const slug of slugsToRemove) {
      await queryRunner.manager.query(
        `DELETE FROM categories WHERE slug = $1`,
        [slug],
      );
    }
  }
}
