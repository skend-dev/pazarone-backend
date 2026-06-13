import { MigrationInterface, QueryRunner } from 'typeorm';
import { CategoryType } from '../categories/entities/category.entity';

/**
 * Expands the Tools category with trade-specific and accessory subcategories.
 * Safe for production: additive only, idempotent (slug-based skip).
 */
export class AddMoreToolsCategories1770620000000 implements MigrationInterface {
  name = 'AddMoreToolsCategories1770620000000';

  private readonly newCategories = [
    {
      name: 'Power Tool Accessories',
      slug: 'power-tool-accessories',
      icon: 'tools',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Прибори за електрични алатки',
        sq: 'Aksesorë për mjete elektrike',
        tr: 'Elektrikli Alet Aksesuarları',
      },
    },
    {
      name: 'Measuring & Layout Tools',
      slug: 'measuring-tools',
      icon: 'tools',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Мерене и поставување',
        sq: 'Mjete matjeje dhe vendosjeje',
        tr: 'Ölçüm ve İşaretleme Aletleri',
      },
    },
    {
      name: 'Tool Storage & Toolboxes',
      slug: 'tool-storage',
      icon: 'organizer',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Складирање на алатки',
        sq: 'Ruajtje mjetesh dhe kuti vegla',
        tr: 'Alet Saklama ve Takım Çantaları',
      },
    },
    {
      name: 'Workshop Equipment',
      slug: 'workshop-equipment',
      icon: 'tools',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Радилница и опрема',
        sq: 'Pajisje pune dhe punishte',
        tr: 'Atölye Ekipmanları',
      },
    },
    {
      name: 'Woodworking Tools',
      slug: 'woodworking-tools',
      icon: 'tools',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Алатки за дрво',
        sq: 'Mjete druri',
        tr: 'Ahşap İşleme Aletleri',
      },
    },
    {
      name: 'Automotive Tools',
      slug: 'automotive-tools',
      icon: 'automotive',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Автомобилски алатки',
        sq: 'Mjete automobilistike',
        tr: 'Otomotiv Aletleri',
      },
    },
    {
      name: 'Welding & Soldering',
      slug: 'welding-soldering',
      icon: 'energy',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Заварување и лемење',
        sq: 'Saldim dhe loderim',
        tr: 'Kaynak ve Lehimleme',
      },
    },
    {
      name: 'Painting & Decorating Tools',
      slug: 'painting-tools',
      icon: 'art',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Алатки за бојење и декорација',
        sq: 'Mjete bojësimi dhe dekorimi',
        tr: 'Boyama ve Dekorasyon Aletleri',
      },
    },
    {
      name: 'Plumbing Tools',
      slug: 'plumbing-tools',
      icon: 'tools',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Водоводни алатки',
        sq: 'Mjete hidraulike',
        tr: 'Tesisat Aletleri',
      },
    },
    {
      name: 'Electrical Installation Tools',
      slug: 'electrical-installation-tools',
      icon: 'cable',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Алатки за електрична инсталација',
        sq: 'Mjete instalimi elektrik',
        tr: 'Elektrik Tesisat Aletleri',
      },
    },
    {
      name: 'Safety & Protective Equipment',
      slug: 'safety-equipment',
      icon: 'immunity',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Безбедност и заштитна опрема',
        sq: 'Siguri dhe mbrojtje',
        tr: 'Güvenlik ve Koruyucu Ekipman',
      },
    },
    {
      name: 'Fasteners & Hardware',
      slug: 'fasteners-hardware',
      icon: 'organizer',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Завртки и хардвер',
        sq: 'Fasteners dhe harduer',
        tr: 'Bağlantı Elemanları ve Hırdavat',
      },
    },
    {
      name: 'Pneumatic & Air Tools',
      slug: 'pneumatic-tools',
      icon: 'tools',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Пневматични алатки',
        sq: 'Mjete pneumatike',
        tr: 'Havalı ve Pnömatik Aletler',
      },
    },
    {
      name: 'Construction & Masonry Tools',
      slug: 'construction-tools',
      icon: 'tools',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Градежни и зидарски алатки',
        sq: 'Mjete ndërtimi dhe muratorie',
        tr: 'İnşaat ve Duvarcılık Aletleri',
      },
    },
    {
      name: 'Outdoor Power Equipment',
      slug: 'outdoor-power-equipment',
      icon: 'garden',
      type: CategoryType.SUBCATEGORY,
      parentSlug: 'tools',
      translations: {
        mk: 'Надворешна моторна опрема',
        sq: 'Pajisje motorike të jashtme',
        tr: 'Dış Mekan Motorlu Ekipmanlar',
      },
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const parent = await queryRunner.manager.query(
      `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
      ['tools'],
    );
    if (parent.length === 0) {
      console.log(
        '⚠️  Parent category "tools" not found. Skipping tools subcategory inserts.',
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
