# Category Seeding Guide

## Overview

This guide explains how to seed categories into the database using the category seed service.

## Adding Categories

Edit `src/categories/categories.seed.ts` to add your categories. The structure supports three levels:

1. **Primary Categories** - Top-level categories (e.g., "Electronics", "Fashion")
2. **Secondary Categories** - Subcategories of primary categories (e.g., "Smartphones" under "Electronics")
3. **Subcategories** - Subcategories of secondary categories (e.g., "iPhone" under "Smartphones")

## Category Structure

Each category requires:
- `name`: Display name (e.g., "Electronics")
- `slug`: URL-friendly identifier (e.g., "electronics")
- `icon`: Emoji or icon identifier (e.g., "📱")
- `type`: `CategoryType.PRIMARY`, `CategoryType.SECONDARY`, or `CategoryType.SUBCATEGORY`
- `parentSlug`: Slug of parent category (null for primary categories)

## Example

```typescript
export const categorySeedData: CategorySeedData[] = [
  // Primary category
  {
    name: 'Electronics',
    slug: 'electronics',
    icon: '📱',
    type: CategoryType.PRIMARY,
    parentSlug: null,
  },
  // Secondary category (child of Electronics)
  {
    name: 'Smartphones',
    slug: 'smartphones',
    icon: '📱',
    type: CategoryType.SECONDARY,
    parentSlug: 'electronics', // References the 'electronics' primary category
  },
  // Subcategory (child of Smartphones)
  {
    name: 'iPhone',
    slug: 'iphone',
    icon: '📱',
    type: CategoryType.SUBCATEGORY,
    parentSlug: 'smartphones', // References the 'smartphones' secondary category
  },
];
```

## Running the Seed

```bash
npm run seed:categories
```

## Important Notes

- The seed script will **skip** if categories already exist in the database
- To re-seed, you need to clear existing categories first (manually or via database)
- Categories are created in order: Primary → Secondary → Subcategories
- Parent categories must be created before their children

## Troubleshooting

If you get errors about missing parents:
1. Ensure parent categories are listed before their children in the seed data
2. Verify `parentSlug` matches the exact `slug` of the parent category
3. Check that primary categories are created before secondary categories

