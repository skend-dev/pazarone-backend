import { Category, CategoryType } from './entities/category.entity';

/**
 * Category seed data with parent slug reference
 * Add your categories here following this structure:
 * - Primary categories have type: CategoryType.PRIMARY and parentSlug: null
 * - Secondary categories have type: CategoryType.SECONDARY and parentSlug: <primary-category-slug>
 * - Subcategories have type: CategoryType.SUBCATEGORY and parentSlug: <secondary-category-slug>
 */
export interface CategorySeedData {
  name: string; // Default name (English)
  slug: string;
  icon: string;
  type: CategoryType;
  parentSlug: string | null; // Reference to parent category slug
  translations?: {
    mk?: string; // Macedonian
    sq?: string; // Albanian
    tr?: string; // Turkish
  };
}

export const categorySeedData: CategorySeedData[] = [
  // ============================================
  // PRIMARY CATEGORIES
  // ============================================
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty',
    icon: 'beauty',
    type: CategoryType.PRIMARY,
    parentSlug: null,
    translations: {
      mk: 'Убавина и лична нега',
      sq: 'Bukuri dhe kujdes personal',
      tr: 'Güzellik ve Kişisel Bakım',
    },
  },
  {
    name: 'Perfumes & Fragrances',
    slug: 'perfumes',
    icon: 'perfume',
    type: CategoryType.PRIMARY,
    parentSlug: null,
    translations: {
      mk: 'Парфеми и мириси',
      sq: 'Parfume dhe aroma',
      tr: 'Parfüm ve Koku',
    },
  },
  {
    name: 'Jewelry & Accessories',
    slug: 'accessories',
    icon: 'accessories',
    type: CategoryType.PRIMARY,
    parentSlug: null,
    translations: {
      mk: 'Накит и аксесоари',
      sq: 'Bizhuteri dhe aksesorë',
      tr: 'Mücevherat ve Aksesuarlar',
    },
  },
  {
    name: 'Bags & Wallets',
    slug: 'bags',
    icon: 'bag',
    type: CategoryType.PRIMARY,
    parentSlug: null,
    translations: {
      mk: 'Торби и паричници',
      sq: 'Çanta dhe portofole',
      tr: 'Çantalar ve Cüzdanlar',
    },
  },
  {
    name: 'Sunglasses & Eyewear',
    slug: 'sunglasses',
    icon: 'sunglasses',
    type: CategoryType.PRIMARY,
    parentSlug: null,
    translations: {
      mk: 'Сончеви очила и очила',
      sq: 'Syze dielli dhe syze',
      tr: 'Güneş Gözlükleri ve Gözlük',
    },
  },
  {
    name: "Women's Clothing",
    slug: 'women-fashion',
    icon: 'fashion',
    type: CategoryType.PRIMARY,
    parentSlug: null,
    translations: {
      mk: 'Женска облека',
      sq: 'Veshje për femra',
      tr: 'Kadın Giyim',
    },
  },
  {
    name: 'Watches',
    slug: 'watches',
    icon: 'watch',
    type: CategoryType.PRIMARY,
    parentSlug: null,
    translations: {
      mk: 'Часовници',
      sq: 'Orë',
      tr: 'Saatler',
    },
  },
  {
    name: 'Shoes & Footwear',
    slug: 'shoes',
    icon: 'shoes',
    type: CategoryType.PRIMARY,
    parentSlug: null,
    translations: {
      mk: 'Чевли и обувки',
      sq: 'Këpucë dhe këpucë',
      tr: 'Ayakkabılar',
    },
  },
  {
    name: 'Underwear & Lingerie',
    slug: 'underwear',
    icon: 'underwear',
    type: CategoryType.PRIMARY,
    parentSlug: null,
    translations: {
      mk: 'Долна облека и дотерок',
      sq: 'Të brendshme dhe lingerie',
      tr: 'İç Çamaşırı ve Gecelik',
    },
  },

  // ============================================
  // SECONDARY CATEGORIES
  // ============================================
  {
    name: 'Phone Accessories',
    slug: 'phone-accessories',
    icon: 'phone',
    type: CategoryType.SECONDARY,
    parentSlug: null,
    translations: {
      mk: 'Аксесоари за телефон',
      sq: 'Aksesorë për telefon',
      tr: 'Telefon Aksesuarları',
    },
  },
  {
    name: 'Home & Kitchen Gadgets',
    slug: 'home-gadgets',
    icon: 'home',
    type: CategoryType.SECONDARY,
    parentSlug: null,
    translations: {
      mk: 'Домашни и кујнски гаџети',
      sq: 'Gadget për shtëpi dhe kuzhinë',
      tr: 'Ev ve Mutfak Aletleri',
    },
  },
  {
    name: "Men's Clothing",
    slug: 'men-fashion',
    icon: 'men',
    type: CategoryType.SECONDARY,
    parentSlug: null,
    translations: {
      mk: 'Машка облека',
      sq: 'Veshje për meshkuj',
      tr: 'Erkek Giyim',
    },
  },
  {
    name: 'Kids & Baby',
    slug: 'kids-baby',
    icon: 'baby',
    type: CategoryType.SECONDARY,
    parentSlug: null,
    translations: {
      mk: 'Деца и бебета',
      sq: 'Fëmijë dhe foshnja',
      tr: 'Çocuk ve Bebek',
    },
  },

  // ============================================
  // SUBCATEGORIES - Beauty & Personal Care
  // ============================================
  {
    name: 'Skincare',
    slug: 'skincare',
    icon: 'skincare',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'beauty',
    translations: {
      mk: 'Нега на кожа',
      sq: 'Kujdesi për lëkurën',
      tr: 'Cilt Bakımı',
    },
  },
  {
    name: 'Makeup',
    slug: 'makeup',
    icon: 'makeup',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'beauty',
    translations: {
      mk: 'Шминка',
      sq: 'Makeup',
      tr: 'Makyaj',
    },
  },
  {
    name: 'Hair Care',
    slug: 'hair-care',
    icon: 'haircare',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'beauty',
    translations: {
      mk: 'Нега на коса',
      sq: 'Kujdesi për flokët',
      tr: 'Saç Bakımı',
    },
  },
  {
    name: 'Body Care',
    slug: 'body-care',
    icon: 'bodycare',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'beauty',
    translations: {
      mk: 'Нега на тело',
      sq: 'Kujdesi për trupin',
      tr: 'Vücut Bakımı',
    },
  },

  // ============================================
  // SUBCATEGORIES - Perfumes & Fragrances
  // ============================================
  {
    name: 'Original Perfumes',
    slug: 'original',
    icon: 'perfume',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'perfumes',
    translations: {
      mk: 'Оригинални парфеми',
      sq: 'Parfume origjinale',
      tr: 'Orijinal Parfümler',
    },
  },
  {
    name: 'Inspired Scents',
    slug: 'inspired',
    icon: 'perfume',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'perfumes',
    translations: {
      mk: 'Инспирирани мириси',
      sq: 'Aroma të frymëzuara',
      tr: 'İlham Veren Kokular',
    },
  },
  {
    name: 'Arabian Perfumes',
    slug: 'arabian',
    icon: 'perfume',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'perfumes',
    translations: {
      mk: 'Арапски парфеми',
      sq: 'Parfume arabe',
      tr: 'Arap Parfümleri',
    },
  },

  // ============================================
  // SUBCATEGORIES - Jewelry & Accessories
  // ============================================
  {
    name: 'Jewelry',
    slug: 'jewelry',
    icon: 'jewelry',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'accessories',
    translations: {
      mk: 'Накит',
      sq: 'Bizhuteri',
      tr: 'Mücevherat',
    },
  },
  {
    name: 'Hair Accessories',
    slug: 'hair-accessories',
    icon: 'hair-accessories',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'accessories',
    translations: {
      mk: 'Аксесоари за коса',
      sq: 'Aksesorë për flokë',
      tr: 'Saç Aksesuarları',
    },
  },
  {
    name: 'Fashion Accessories',
    slug: 'fashion-accessories',
    icon: 'fashion-accessories',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'accessories',
    translations: {
      mk: 'Модни аксесоари',
      sq: 'Aksesorë modë',
      tr: 'Moda Aksesuarları',
    },
  },
  {
    name: 'Belts',
    slug: 'belts',
    icon: 'belt',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'accessories',
    translations: {
      mk: 'Појасови',
      sq: 'Rripa',
      tr: 'Kemerler',
    },
  },
  {
    name: 'Hats & Caps',
    slug: 'hats-caps',
    icon: 'hat',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'accessories',
    translations: {
      mk: 'Шапки и капи',
      sq: 'Kapele dhe kapelë',
      tr: 'Şapkalar ve Kasketler',
    },
  },

  // ============================================
  // SUBCATEGORIES - Bags & Wallets
  // ============================================
  {
    name: 'Handbags',
    slug: 'handbags',
    icon: 'handbag',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'bags',
    translations: {
      mk: 'Чанти',
      sq: 'Çanta',
      tr: 'El Çantaları',
    },
  },
  {
    name: 'Crossbody Bags',
    slug: 'crossbody',
    icon: 'crossbody',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'bags',
    translations: {
      mk: 'Напречни торби',
      sq: 'Çanta tërthore',
      tr: 'Çapraz Çantalar',
    },
  },
  {
    name: 'Wallets',
    slug: 'wallets',
    icon: 'wallet',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'bags',
    translations: {
      mk: 'Паричници',
      sq: 'Portofole',
      tr: 'Cüzdanlar',
    },
  },
  {
    name: 'Backpacks',
    slug: 'backpacks',
    icon: 'backpack',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'bags',
    translations: {
      mk: 'Раници',
      sq: 'Çanta shpine',
      tr: 'Sırt Çantaları',
    },
  },

  // ============================================
  // SUBCATEGORIES - Sunglasses & Eyewear
  // ============================================
  {
    name: "Women's Sunglasses",
    slug: 'women-sunglasses',
    icon: 'sunglasses',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'sunglasses',
    translations: {
      mk: 'Женски сончеви очила',
      sq: 'Syze dielli për femra',
      tr: 'Kadın Güneş Gözlükleri',
    },
  },
  {
    name: "Men's Sunglasses",
    slug: 'men-sunglasses',
    icon: 'sunglasses',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'sunglasses',
    translations: {
      mk: 'Машки сончеви очила',
      sq: 'Syze dielli për meshkuj',
      tr: 'Erkek Güneş Gözlükleri',
    },
  },

  // ============================================
  // SUBCATEGORIES - Women's Clothing
  // ============================================
  {
    name: 'Tops & Blouses',
    slug: 'tops-blouses',
    icon: 'top',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'women-fashion',
    translations: {
      mk: 'Топови и блузи',
      sq: 'Tunika dhe bluza',
      tr: 'Üstler ve Bluzlar',
    },
  },
  {
    name: 'Dresses',
    slug: 'dresses',
    icon: 'dress',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'women-fashion',
    translations: {
      mk: 'Фустани',
      sq: 'Fustane',
      tr: 'Elbiseler',
    },
  },
  {
    name: 'Skirts',
    slug: 'skirts',
    icon: 'skirt',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'women-fashion',
    translations: {
      mk: 'Сукњи',
      sq: 'Fund',
      tr: 'Etekler',
    },
  },
  {
    name: 'Activewear',
    slug: 'activewear',
    icon: 'activewear',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'women-fashion',
    translations: {
      mk: 'Спортска облека',
      sq: 'Veshje sportive',
      tr: 'Spor Giyim',
    },
  },
  {
    name: 'Pants & Jeans',
    slug: 'pants-jeans',
    icon: 'pants',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'women-fashion',
    translations: {
      mk: 'Пантолони и фармерки',
      sq: 'Pantallona dhe xhinse',
      tr: 'Pantolonlar ve Kotlar',
    },
  },
  {
    name: 'Outerwear',
    slug: 'women-outerwear',
    icon: 'jacket',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'women-fashion',
    translations: {
      mk: 'Надворешна облека',
      sq: 'Veshje e jashtme',
      tr: 'Dış Giyim',
    },
  },
  {
    name: 'Leggings',
    slug: 'leggings',
    icon: 'leggings',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'women-fashion',
    translations: {
      mk: 'Леггинси',
      sq: 'Leggjings',
      tr: 'Taytlar',
    },
  },

  // ============================================
  // SUBCATEGORIES - Watches
  // ============================================
  {
    name: "Women's Watches",
    slug: 'women-watches',
    icon: 'watch',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'watches',
    translations: {
      mk: 'Женски часовници',
      sq: 'Orë për femra',
      tr: 'Kadın Saatleri',
    },
  },
  {
    name: "Men's Watches",
    slug: 'men-watches',
    icon: 'watch',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'watches',
    translations: {
      mk: 'Машки часовници',
      sq: 'Orë për meshkuj',
      tr: 'Erkek Saatleri',
    },
  },
  {
    name: 'Smartwatches',
    slug: 'smartwatches',
    icon: 'smartwatch',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'watches',
    translations: {
      mk: 'Паметни часовници',
      sq: 'Orë inteligjente',
      tr: 'Akıllı Saatler',
    },
  },

  // ============================================
  // SUBCATEGORIES - Phone Accessories
  // ============================================
  {
    name: 'Phone Cases',
    slug: 'cases',
    icon: 'phone-case',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'phone-accessories',
    translations: {
      mk: 'Куќишта за телефон',
      sq: 'Kutia për telefon',
      tr: 'Telefon Kılıfları',
    },
  },
  {
    name: 'Chargers',
    slug: 'chargers',
    icon: 'charger',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'phone-accessories',
    translations: {
      mk: 'Полначи',
      sq: 'Karikues',
      tr: 'Şarj Cihazları',
    },
  },
  {
    name: 'Cables',
    slug: 'cables',
    icon: 'cable',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'phone-accessories',
    translations: {
      mk: 'Кабли',
      sq: 'Kablo',
      tr: 'Kablolar',
    },
  },

  // ============================================
  // SUBCATEGORIES - Home & Kitchen Gadgets
  // ============================================
  {
    name: 'Organizers',
    slug: 'organizers',
    icon: 'organizer',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'home-gadgets',
    translations: {
      mk: 'Организери',
      sq: 'Organizues',
      tr: 'Organizatörler',
    },
  },
  {
    name: 'Kitchen Tools',
    slug: 'kitchen-tools',
    icon: 'kitchen',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'home-gadgets',
    translations: {
      mk: 'Кујнски алатки',
      sq: 'Mjete kuzhine',
      tr: 'Mutfak Aletleri',
    },
  },
  {
    name: 'Mini Gadgets',
    slug: 'mini-gadgets',
    icon: 'gadget',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'home-gadgets',
    translations: {
      mk: 'Мини гаџети',
      sq: 'Gadget mini',
      tr: 'Mini Aletler',
    },
  },

  // ============================================
  // SUBCATEGORIES - Men's Clothing
  // ============================================
  {
    name: 'T-shirts',
    slug: 't-shirts',
    icon: 'tshirt',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'men-fashion',
    translations: {
      mk: 'Маички',
      sq: 'T-shirta',
      tr: 'Tişörtler',
    },
  },
  {
    name: 'Hoodies',
    slug: 'hoodies',
    icon: 'hoodie',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'men-fashion',
    translations: {
      mk: 'Дуксерки',
      sq: 'Hoodie',
      tr: 'Kapüşonlular',
    },
  },
  {
    name: 'Joggers',
    slug: 'joggers',
    icon: 'jogger',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'men-fashion',
    translations: {
      mk: 'Џогирачки',
      sq: 'Pantallona sportive',
      tr: 'Spor Pantolonlar',
    },
  },
  {
    name: 'Jeans',
    slug: 'jeans',
    icon: 'jeans',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'men-fashion',
    translations: {
      mk: 'Фармерки',
      sq: 'Xhinse',
      tr: 'Kotlar',
    },
  },
  {
    name: 'Pants',
    slug: 'pants',
    icon: 'pants',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'men-fashion',
    translations: {
      mk: 'Пантолони',
      sq: 'Pantallona',
      tr: 'Pantolonlar',
    },
  },
  {
    name: 'Shorts',
    slug: 'shorts',
    icon: 'shorts',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'men-fashion',
    translations: {
      mk: 'Шорцеви',
      sq: 'Pantallona të shkurtra',
      tr: 'Şortlar',
    },
  },
  {
    name: 'Outerwear',
    slug: 'men-outerwear',
    icon: 'jacket',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'men-fashion',
    translations: {
      mk: 'Надворешна облека',
      sq: 'Veshje e jashtme',
      tr: 'Dış Giyim',
    },
  },

  // ============================================
  // SUBCATEGORIES - Kids & Baby
  // ============================================
  {
    name: 'Baby Clothes',
    slug: 'baby-clothes',
    icon: 'baby-clothes',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'kids-baby',
    translations: {
      mk: 'Бебетска облека',
      sq: 'Veshje për foshnja',
      tr: 'Bebek Giyim',
    },
  },
  {
    name: 'Kids Toys',
    slug: 'kids-toys',
    icon: 'toy',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'kids-baby',
    translations: {
      mk: 'Дечии играчки',
      sq: 'Lodra për fëmijë',
      tr: 'Çocuk Oyuncakları',
    },
  },

  // ============================================
  // SUBCATEGORIES - Shoes & Footwear
  // ============================================
  {
    name: "Women's Shoes",
    slug: 'women-shoes',
    icon: 'shoes',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'shoes',
    translations: {
      mk: 'Женски чевли',
      sq: 'Këpucë për femra',
      tr: 'Kadın Ayakkabıları',
    },
  },
  {
    name: "Men's Shoes",
    slug: 'men-shoes',
    icon: 'shoes',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'shoes',
    translations: {
      mk: 'Машки чевли',
      sq: 'Këpucë për meshkuj',
      tr: 'Erkek Ayakkabıları',
    },
  },
  {
    name: 'Sneakers',
    slug: 'sneakers',
    icon: 'sneakers',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'shoes',
    translations: {
      mk: 'Патики',
      sq: 'Këpucë sportive',
      tr: 'Spor Ayakkabılar',
    },
  },
  {
    name: 'Boots',
    slug: 'boots',
    icon: 'boots',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'shoes',
    translations: {
      mk: 'Чизми',
      sq: 'Çizme',
      tr: 'Botlar',
    },
  },
  {
    name: 'Sandals',
    slug: 'sandals',
    icon: 'sandals',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'shoes',
    translations: {
      mk: 'Сандали',
      sq: 'Sandale',
      tr: 'Sandaletler',
    },
  },
  {
    name: 'Heels',
    slug: 'heels',
    icon: 'heels',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'shoes',
    translations: {
      mk: 'Чевли на потпетица',
      sq: 'Këpucë me takë',
      tr: 'Topuklu Ayakkabılar',
    },
  },
  {
    name: "Kids' Shoes",
    slug: 'kids-shoes',
    icon: 'shoes',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'shoes',
    translations: {
      mk: 'Дечии чевли',
      sq: 'Këpucë për fëmijë',
      tr: 'Çocuk Ayakkabıları',
    },
  },

  // ============================================
  // SUBCATEGORIES - Underwear & Lingerie
  // ============================================
  {
    name: "Women's Underwear",
    slug: 'women-underwear',
    icon: 'underwear',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'underwear',
    translations: {
      mk: 'Женско долно облекување',
      sq: 'Të brendshme për femra',
      tr: 'Kadın İç Çamaşırı',
    },
  },
  {
    name: "Men's Underwear",
    slug: 'men-underwear',
    icon: 'underwear',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'underwear',
    translations: {
      mk: 'Машко долно облекување',
      sq: 'Të brendshme për meshkuj',
      tr: 'Erkek İç Çamaşırı',
    },
  },
  {
    name: 'Lingerie',
    slug: 'lingerie',
    icon: 'lingerie',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'underwear',
    translations: {
      mk: 'Дотерок',
      sq: 'Lingerie',
      tr: 'İç Giyim',
    },
  },
  {
    name: 'Socks',
    slug: 'socks',
    icon: 'socks',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'underwear',
    translations: {
      mk: 'Чорапи',
      sq: 'Çorape',
      tr: 'Çoraplar',
    },
  },
];
