import { MigrationInterface, QueryRunner } from 'typeorm';
import { CategoryType } from '../categories/entities/category.entity';

/**
 * Adds Tools primary category with Electric Tools, Hand Tools, and Garden Tools subcategories.
 * Safe for production: additive only, idempotent (slug-based skip).
 */
export class AddToolsCategories1770610000000 implements MigrationInterface {
  name = 'AddToolsCategories1770610000000';

  private readonly newCategories = [
    {
      name: 'Tools',
      slug: 'tools',
      icon: 'tools',
      type: CategoryType.PRIMARY,
      parentSlug: null as string | null,
      translations: {
        mk: 'Алатки',
        sq: 'Mjete',
        tr: 'Aletler',
      },
    },
    {
      name: 'Electric Tools',
      slug: 'electric-tools',
      icon: 'tools',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Електрични алатки',
        sq: 'Mjete elektrike',
        tr: 'Elektrikli Aletler',
      },
    },
    {
      name: 'Hand Tools',
      slug: 'hand-tools',
      icon: 'tools',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Рачни алатки',
        sq: 'Mjete dore',
        tr: 'El Aletleri',
      },
    },
    {
      name: 'Garden Tools',
      slug: 'garden-tools',
      icon: 'garden',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Градинарски алатки',
        sq: 'Mjete kopshti',
        tr: 'Bahçe Aletleri',
      },
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const categoryMap = new Map<string, string>();

    const topLevel = this.newCategories.filter((c) => c.parentSlug === null);
    for (const catData of topLevel) {
      const existing = await queryRunner.manager.query(
        `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
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
        console.log(`✓ Created category: ${catData.name}`);
      } else {
        categoryMap.set(catData.slug, existing[0].id);
        console.log(`⏭️  Category '${catData.name}' already exists. Skipping.`);
      }
    }

    const subcategories = this.newCategories.filter((c) => c.parentSlug !== null);
    for (const catData of subcategories) {
      const existing = await queryRunner.manager.query(
        `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
        [catData.slug],
      );
      if (existing.length > 0) {
        console.log(`⏭️  Category '${catData.name}' already exists. Skipping.`);
        continue;
      }

      let parentId = categoryMap.get(catData.parentSlug!);
      if (!parentId) {
        const existingParent = await queryRunner.manager.query(
          `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
          [catData.parentSlug],
        );
        parentId = existingParent.length > 0 ? existingParent[0].id : null;
      }
      if (!parentId) {
        console.log(
          `⚠️  Parent category "${catData.parentSlug}" not found. Skipping ${catData.name}.`,
        );
        continue;
      }

      await queryRunner.manager.query(
        `INSERT INTO categories (id, name, slug, icon, type, "parentId", translations, "createdAt", "updatedAt")
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), now())
         ON CONFLICT (slug) DO NOTHING`,
        [
          catData.name,
          catData.slug,
          catData.icon,
          catData.type,
          parentId,
          catData.translations ? JSON.stringify(catData.translations) : null,
        ],
      );
      console.log(`✓ Ensured category: ${catData.name}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const subSlugs = ['electric-tools', 'hand-tools', 'garden-tools'];
    const primarySlugs = ['tools'];
    const allSlugs = [...subSlugs, ...primarySlugs];

    await queryRunner.manager.query(
      `UPDATE products
       SET "categoryId" = NULL
       WHERE "categoryId" IN (
         SELECT id FROM categories WHERE slug = ANY($1)
       )`,
      [allSlugs],
    );

    await queryRunner.manager.query(
      `DELETE FROM categories WHERE slug = ANY($1)`,
      [subSlugs],
    );
    await queryRunner.manager.query(
      `DELETE FROM categories WHERE slug = ANY($1)`,
      [primarySlugs],
    );
  }
}
