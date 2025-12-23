import { Category, CategoryType } from './entities/category.entity';

/**
 * Category seed data with parent slug reference
 * Add your categories here following this structure:
 * - Primary categories have type: CategoryType.PRIMARY and parentSlug: null
 * - Secondary categories have type: CategoryType.SECONDARY and parentSlug: <primary-category-slug>
 * - Subcategories have type: CategoryType.SUBCATEGORY and parentSlug: <secondary-category-slug>
 */
export interface CategorySeedData {
  name: string;
  slug: string;
  icon: string;
  type: CategoryType;
  parentSlug: string | null; // Reference to parent category slug
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
  },
  {
    name: 'Perfumes & Fragrances',
    slug: 'perfumes',
    icon: 'perfume',
    type: CategoryType.PRIMARY,
    parentSlug: null,
  },
  {
    name: 'Jewelry & Accessories',
    slug: 'accessories',
    icon: 'accessories',
    type: CategoryType.PRIMARY,
    parentSlug: null,
  },
  {
    name: 'Bags & Wallets',
    slug: 'bags',
    icon: 'bag',
    type: CategoryType.PRIMARY,
    parentSlug: null,
  },
  {
    name: 'Sunglasses & Eyewear',
    slug: 'sunglasses',
    icon: 'sunglasses',
    type: CategoryType.PRIMARY,
    parentSlug: null,
  },
  {
    name: "Women's Clothing",
    slug: 'women-fashion',
    icon: 'fashion',
    type: CategoryType.PRIMARY,
    parentSlug: null,
  },
  {
    name: 'Watches',
    slug: 'watches',
    icon: 'watch',
    type: CategoryType.PRIMARY,
    parentSlug: null,
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
  },
  {
    name: 'Home & Kitchen Gadgets',
    slug: 'home-gadgets',
    icon: 'home',
    type: CategoryType.SECONDARY,
    parentSlug: null,
  },
  {
    name: "Men's Clothing",
    slug: 'men-fashion',
    icon: 'men',
    type: CategoryType.SECONDARY,
    parentSlug: null,
  },
  {
    name: 'Kids & Baby',
    slug: 'kids-baby',
    icon: 'baby',
    type: CategoryType.SECONDARY,
    parentSlug: null,
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
  },
  {
    name: 'Makeup',
    slug: 'makeup',
    icon: 'makeup',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'beauty',
  },
  {
    name: 'Hair Care',
    slug: 'hair-care',
    icon: 'haircare',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'beauty',
  },
  {
    name: 'Body Care',
    slug: 'body-care',
    icon: 'bodycare',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'beauty',
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
  },
  {
    name: 'Inspired Scents',
    slug: 'inspired',
    icon: 'perfume',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'perfumes',
  },
  {
    name: 'Arabian Perfumes',
    slug: 'arabian',
    icon: 'perfume',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'perfumes',
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
  },
  {
    name: 'Hair Accessories',
    slug: 'hair-accessories',
    icon: 'hair-accessories',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'accessories',
  },
  {
    name: 'Fashion Accessories',
    slug: 'fashion-accessories',
    icon: 'fashion-accessories',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'accessories',
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
  },
  {
    name: 'Crossbody Bags',
    slug: 'crossbody',
    icon: 'crossbody',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'bags',
  },
  {
    name: 'Wallets',
    slug: 'wallets',
    icon: 'wallet',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'bags',
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
  },
  {
    name: "Men's Sunglasses",
    slug: 'men-sunglasses',
    icon: 'sunglasses',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'sunglasses',
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
  },
  {
    name: 'Dresses',
    slug: 'dresses',
    icon: 'dress',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'women-fashion',
  },
  {
    name: 'Skirts',
    slug: 'skirts',
    icon: 'skirt',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'women-fashion',
  },
  {
    name: 'Activewear',
    slug: 'activewear',
    icon: 'activewear',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'women-fashion',
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
  },
  {
    name: "Men's Watches",
    slug: 'men-watches',
    icon: 'watch',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'watches',
  },
  {
    name: 'Smartwatches',
    slug: 'smartwatches',
    icon: 'smartwatch',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'watches',
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
  },
  {
    name: 'Chargers',
    slug: 'chargers',
    icon: 'charger',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'phone-accessories',
  },
  {
    name: 'Cables',
    slug: 'cables',
    icon: 'cable',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'phone-accessories',
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
  },
  {
    name: 'Kitchen Tools',
    slug: 'kitchen-tools',
    icon: 'kitchen',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'home-gadgets',
  },
  {
    name: 'Mini Gadgets',
    slug: 'mini-gadgets',
    icon: 'gadget',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'home-gadgets',
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
  },
  {
    name: 'Hoodies',
    slug: 'hoodies',
    icon: 'hoodie',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'men-fashion',
  },
  {
    name: 'Joggers',
    slug: 'joggers',
    icon: 'jogger',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'men-fashion',
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
  },
  {
    name: 'Kids Toys',
    slug: 'kids-toys',
    icon: 'toy',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'kids-baby',
  },
];
