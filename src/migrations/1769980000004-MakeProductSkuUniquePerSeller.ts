import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes SKU unique per seller instead of globally.
 * Different sellers can now use the same SKU (e.g. both "SHIRT-001").
 * Each seller still cannot have duplicate SKUs within their own products.
 */
export class MakeProductSkuUniquePerSeller1769980000004
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the global unique constraint on sku (idempotent)
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "UQ_products_sku"`,
    );

    // Add composite unique: (sellerId, sku) - allows same SKU across sellers, unique per seller
    // Partial index: only enforce when sku is not null (multiple nulls allowed)
    // IF NOT EXISTS: safe for re-runs or partial migrations
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_products_sellerId_sku"
      ON "products" ("sellerId", "sku")
      WHERE "sku" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the per-seller unique index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_products_sellerId_sku"`,
    );

    // Restore global unique on sku (may fail if duplicate skus exist across sellers)
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "UQ_products_sku" UNIQUE ("sku")`,
    );
  }
}
