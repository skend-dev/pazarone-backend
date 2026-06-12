import { MigrationInterface, QueryRunner } from 'typeorm';
import { CategoryType } from '../categories/entities/category.entity';

/**
 * Baby product subcategories for WooCommerce import.
 * Safe for production: additive only, idempotent (slug-based skip / ON CONFLICT).
 */
export class AddBabyProductCategories1770500000000
  implements MigrationInterface
{
  name = 'AddBabyProductCategories1770500000000';

  private readonly newCategories = [
    {
      name: 'Baby Cribs',
      slug: 'baby-cribs',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Бебешки Кревети',
        sq: 'Krevate për foshnja',
        tr: 'Bebek Karyolaları',
      },
    },
    {
      name: 'Kids Beds',
      slug: 'kids-beds',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Детски Кревети',
        sq: 'Krevate për fëmijë',
        tr: 'Çocuk Yatakları',
      },
    },
    {
      name: 'Strollers',
      slug: 'strollers',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Колички',
        sq: 'Karroca',
        tr: 'Bebek Arabaları',
      },
    },
    {
      name: 'Baby Bedding',
      slug: 'baby-bedding',
      icon: 'bedding',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Постелнини',
        sq: 'Shtroje për foshnja',
        tr: 'Bebek Nevresimleri',
      },
    },
    {
      name: 'Baby Rockers',
      slug: 'baby-rockers',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Лулки',
        sq: 'Këndëset për foshnja',
        tr: 'Bebek Sallanakları',
      },
    },
    {
      name: 'Breast Pumps',
      slug: 'breast-pumps',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Eлектрична пумпа за доене',
        sq: 'Pompë gjoksi',
        tr: 'Elektrikli Süt Pompaları',
      },
    },
    {
      name: 'High Chairs',
      slug: 'high-chairs',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Хранилки',
        sq: 'Karrige ushqimi',
        tr: 'Mama Sandalyeleri',
      },
    },
    {
      name: 'Electric Baby Swings',
      slug: 'electric-baby-swings',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Електрични лулки',
        sq: 'Këndëse elektrike për foshnja',
        tr: 'Elektrikli Bebek Sallanakları',
      },
    },
    {
      name: 'Baby Carriers',
      slug: 'baby-carriers',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Транспортери',
        sq: 'Mbajtëse për foshnja',
        tr: 'Bebek Taşıyıcıları',
      },
    },
    {
      name: 'Baby Monitors',
      slug: 'baby-monitors',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Бабу монитор',
        sq: 'Monitor për foshnja',
        tr: 'Bebek Monitörleri',
      },
    },
    {
      name: 'Ride-On Toys',
      slug: 'kids-ride-ons',
      icon: 'toy',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Трицикли / Точаци / Тротинети',
        sq: 'Triçikla / Kërrica / Skuterë',
        tr: 'Üç Tekerlekli / Yürüteç / Scooter',
      },
    },
    {
      name: 'Baby Bath',
      slug: 'baby-bath',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Корито за бањање',
        sq: 'Vaskë banjeje',
        tr: 'Bebek Banyo Küvetleri',
      },
    },
    {
      name: 'Nursery Storage',
      slug: 'nursery-storage',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Плакар фиокар',
        sq: 'Dollap për dhomë foshnje',
        tr: 'Bebek Odası Dolabı',
      },
    },
    {
      name: 'Baby Bouncers',
      slug: 'baby-bouncers',
      icon: 'baby',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'kids-baby',
      translations: {
        mk: 'Релаксатор',
        sq: 'Karrige lëkundëse',
        tr: 'Bebek Salıncakları',
      },
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const parent = await queryRunner.manager.query(
      `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
      ['kids-baby'],
    );
    if (parent.length === 0) {
      console.log(
        '⚠️  Parent category "kids-baby" not found. Skipping baby category inserts.',
      );
      return;
    }
    const parentId = parent[0].id;

    for (const catData of this.newCategories) {
      const existing = await queryRunner.manager.query(
        `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
        [catData.slug],
      );
      if (existing.length > 0) {
        console.log(`⏭️  Category '${catData.name}' already exists. Skipping.`);
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
    const slugs = this.newCategories.map((c) => c.slug);

    await queryRunner.manager.query(
      `UPDATE products
       SET "categoryId" = NULL
       WHERE "categoryId" IN (
         SELECT id FROM categories WHERE slug = ANY($1)
       )`,
      [slugs],
    );

    await queryRunner.manager.query(
      `DELETE FROM categories WHERE slug = ANY($1)`,
      [slugs],
    );
  }
}
