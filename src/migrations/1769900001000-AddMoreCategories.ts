import { MigrationInterface, QueryRunner } from 'typeorm';
import { CategoryType } from '../categories/entities/category.entity';

/**
 * Adds Electronics & Tech, Sports & Outdoors, Home & Living, Pet Supplies, Books & Stationery,
 * plus subcategories and extra Kids & Baby subcategories (Kids Clothing, Baby Care, Maternity).
 * Safe for production: idempotent (skips insert if slug already exists), additive only.
 */
export class AddMoreCategories1769900001000 implements MigrationInterface {
  name = 'AddMoreCategories1769900001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const newCategories = [
      // Primary
      {
        name: 'Electronics & Tech',
        slug: 'electronics',
        icon: 'laptop',
        type: CategoryType.PRIMARY,
        parentSlug: null as string | null,
        translations: { mk: 'Електроника и технологија', sq: 'Elektronika dhe teknologji', tr: 'Elektronik ve Teknoloji' },
      },
      {
        name: 'Sports & Outdoors',
        slug: 'sports-outdoors',
        icon: 'sports',
        type: CategoryType.PRIMARY,
        parentSlug: null,
        translations: { mk: 'Спорт и отворено', sq: 'Sport dhe natyrë', tr: 'Spor ve Açık Hava' },
      },
      {
        name: 'Home & Living',
        slug: 'home-living',
        icon: 'home',
        type: CategoryType.PRIMARY,
        parentSlug: null,
        translations: { mk: 'Дом и живеалиште', sq: 'Shtëpi dhe jetesë', tr: 'Ev ve Yaşam' },
      },
      {
        name: 'Pet Supplies',
        slug: 'pet-supplies',
        icon: 'pet',
        type: CategoryType.PRIMARY,
        parentSlug: null,
        translations: { mk: 'Производи за миленици', sq: 'Produkte për kafshët shtëpiake', tr: 'Evcil Hayvan Ürünleri' },
      },
      {
        name: 'Books & Stationery',
        slug: 'books-stationery',
        icon: 'book',
        type: CategoryType.PRIMARY,
        parentSlug: null,
        translations: { mk: 'Книги и канцелариски материјали', sq: 'Libra dhe materiale zyri', tr: 'Kitap ve Kırtasiye' },
      },
      // Sub - Electronics
      { name: 'Laptops & Computers', slug: 'laptops-computers', icon: 'laptop', type: CategoryType.SUBCATEGORY, parentSlug: 'electronics', translations: { mk: 'Лаптопи и компјутери', sq: 'Laptopa dhe kompjuterë', tr: 'Dizüstü ve Masaüstü Bilgisayarlar' } },
      { name: 'Headphones & Audio', slug: 'headphones-audio', icon: 'headphones', type: CategoryType.SUBCATEGORY, parentSlug: 'electronics', translations: { mk: 'Слушалки и аудио', sq: 'Kufje dhe audio', tr: 'Kulaklık ve Ses Sistemleri' } },
      { name: 'Gaming', slug: 'gaming', icon: 'gaming', type: CategoryType.SUBCATEGORY, parentSlug: 'electronics', translations: { mk: 'Игри', sq: 'Gaming', tr: 'Oyun' } },
      { name: 'Cameras & Photo', slug: 'cameras-photo', icon: 'camera', type: CategoryType.SUBCATEGORY, parentSlug: 'electronics', translations: { mk: 'Камери и фотографија', sq: 'Kamera dhe foto', tr: 'Kamera ve Fotoğraf' } },
      { name: 'TV & Monitors', slug: 'tv-monitors', icon: 'tv', type: CategoryType.SUBCATEGORY, parentSlug: 'electronics', translations: { mk: 'ТВ и монитори', sq: 'TV dhe monitorë', tr: 'TV ve Monitörler' } },
      // Sub - Sports & Outdoors
      { name: 'Sports Clothing', slug: 'sports-clothing', icon: 'sports', type: CategoryType.SUBCATEGORY, parentSlug: 'sports-outdoors', translations: { mk: 'Спортска облека', sq: 'Veshje sportive', tr: 'Spor Giyim' } },
      { name: 'Fitness Equipment', slug: 'fitness-equipment', icon: 'fitness', type: CategoryType.SUBCATEGORY, parentSlug: 'sports-outdoors', translations: { mk: 'Фитнес опрема', sq: 'Pajisje fitnesi', tr: 'Fitness Ekipmanları' } },
      { name: 'Camping & Outdoor', slug: 'camping-outdoor', icon: 'camping', type: CategoryType.SUBCATEGORY, parentSlug: 'sports-outdoors', translations: { mk: 'Кемпинг и отворено', sq: 'Kamping dhe natyrë', tr: 'Kamp ve Açık Hava' } },
      { name: 'Sports Equipment', slug: 'sports-equipment', icon: 'sports', type: CategoryType.SUBCATEGORY, parentSlug: 'sports-outdoors', translations: { mk: 'Спортска опрема', sq: 'Pajisje sportive', tr: 'Spor Ekipmanları' } },
      // Sub - Home & Living
      { name: 'Home Decor', slug: 'home-decor', icon: 'home', type: CategoryType.SUBCATEGORY, parentSlug: 'home-living', translations: { mk: 'Домашен декор', sq: 'Dekor shtëpie', tr: 'Ev Dekorasyonu' } },
      { name: 'Bedding & Bath', slug: 'bedding-bath', icon: 'bedding', type: CategoryType.SUBCATEGORY, parentSlug: 'home-living', translations: { mk: 'Постелнина и бања', sq: 'Shtroje dhe banjo', tr: 'Yatak ve Banyo' } },
      { name: 'Lighting', slug: 'lighting', icon: 'lighting', type: CategoryType.SUBCATEGORY, parentSlug: 'home-living', translations: { mk: 'Осветлување', sq: 'Ndriçim', tr: 'Aydınlatma' } },
      { name: 'Kitchen & Dining', slug: 'kitchen-dining', icon: 'kitchen', type: CategoryType.SUBCATEGORY, parentSlug: 'home-living', translations: { mk: 'Кујна и трпезарија', sq: 'Kuzhinë dhe darkë', tr: 'Mutfak ve Yemek' } },
      // Sub - Pet Supplies
      { name: 'Pet Food & Treats', slug: 'pet-food-treats', icon: 'pet', type: CategoryType.SUBCATEGORY, parentSlug: 'pet-supplies', translations: { mk: 'Храна и посластици за миленици', sq: 'Ushqim dhe trajtime për kafshë', tr: 'Evcil Hayvan Maması ve Ödülleri' } },
      { name: 'Pet Accessories', slug: 'pet-accessories', icon: 'pet', type: CategoryType.SUBCATEGORY, parentSlug: 'pet-supplies', translations: { mk: 'Аксесоари за миленици', sq: 'Aksesorë për kafshë', tr: 'Evcil Hayvan Aksesuarları' } },
      { name: 'Pet Care', slug: 'pet-care', icon: 'pet', type: CategoryType.SUBCATEGORY, parentSlug: 'pet-supplies', translations: { mk: 'Нега за миленици', sq: 'Kujdes për kafshë', tr: 'Evcil Hayvan Bakımı' } },
      // Sub - Books & Stationery
      { name: 'Books', slug: 'books', icon: 'book', type: CategoryType.SUBCATEGORY, parentSlug: 'books-stationery', translations: { mk: 'Книги', sq: 'Libra', tr: 'Kitaplar' } },
      { name: 'Office Supplies', slug: 'office-supplies', icon: 'office', type: CategoryType.SUBCATEGORY, parentSlug: 'books-stationery', translations: { mk: 'Канцелариски материјали', sq: 'Materiale zyri', tr: 'Ofis Malzemeleri' } },
      { name: 'Art & Craft', slug: 'art-craft', icon: 'art', type: CategoryType.SUBCATEGORY, parentSlug: 'books-stationery', translations: { mk: 'Уметност и занает', sq: 'Art dhe zeje', tr: 'Sanat ve El Sanatları' } },
      // Sub - Kids & Baby (existing secondary)
      { name: 'Kids Clothing', slug: 'kids-clothing', icon: 'baby', type: CategoryType.SUBCATEGORY, parentSlug: 'kids-baby', translations: { mk: 'Детска облека', sq: 'Veshje për fëmijë', tr: 'Çocuk Giyim' } },
      { name: 'Baby Care', slug: 'baby-care', icon: 'baby', type: CategoryType.SUBCATEGORY, parentSlug: 'kids-baby', translations: { mk: 'Нега за бебета', sq: 'Kujdes për foshnja', tr: 'Bebek Bakımı' } },
      { name: 'Maternity', slug: 'maternity', icon: 'maternity', type: CategoryType.SUBCATEGORY, parentSlug: 'kids-baby', translations: { mk: 'Бремени', sq: 'Shtatzëni', tr: 'Hamilelik' } },
    ];

    const categoryMap = new Map<string, string>();

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

    // Subcategories: need parent from categoryMap or existing DB (e.g. kids-baby)
    const subcategories = newCategories.filter((c) => c.parentSlug !== null);
    for (const catData of subcategories) {
      const existing = await queryRunner.manager.query(
        `SELECT id FROM categories WHERE slug = $1`,
        [catData.slug],
      );
      if (existing.length > 0) continue;

      let parentId = categoryMap.get(catData.parentSlug!);
      if (!parentId) {
        const existingParent = await queryRunner.manager.query(
          `SELECT id FROM categories WHERE slug = $1`,
          [catData.parentSlug],
        );
        parentId = existingParent.length > 0 ? existingParent[0].id : null;
      }
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
    const subSlugs = [
      'laptops-computers', 'headphones-audio', 'gaming', 'cameras-photo', 'tv-monitors',
      'sports-clothing', 'fitness-equipment', 'camping-outdoor', 'sports-equipment',
      'home-decor', 'bedding-bath', 'lighting', 'kitchen-dining',
      'pet-food-treats', 'pet-accessories', 'pet-care',
      'books', 'office-supplies', 'art-craft',
      'kids-clothing', 'baby-care', 'maternity',
    ];
    const primarySlugs = ['electronics', 'sports-outdoors', 'home-living', 'pet-supplies', 'books-stationery'];
    const allSlugs = [...subSlugs, ...primarySlugs];

    await queryRunner.manager.query(
      `UPDATE products SET "categoryId" = NULL WHERE "categoryId" IN (SELECT id FROM categories WHERE slug = ANY($1))`,
      [allSlugs],
    );
    for (const slug of subSlugs) {
      await queryRunner.manager.query(`DELETE FROM categories WHERE slug = $1`, [slug]);
    }
    for (const slug of primarySlugs) {
      await queryRunner.manager.query(`DELETE FROM categories WHERE slug = $1`, [slug]);
    }
  }
}
