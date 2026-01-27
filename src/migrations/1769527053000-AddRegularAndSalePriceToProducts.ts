import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegularAndSalePriceToProducts1769527053000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if columns already exist to make migration idempotent
    const table = await queryRunner.getTable('products');
    const hasRegularPrice = table?.findColumnByName('regularPrice');
    const hasSalePrice = table?.findColumnByName('salePrice');
    const hasSalePriceExpiresAt = table?.findColumnByName('salePriceExpiresAt');

    // Add regularPrice column if it doesn't exist
    if (!hasRegularPrice) {
      await queryRunner.query(`
        ALTER TABLE "products"
        ADD COLUMN "regularPrice" decimal(10,2)
      `);
    }

    // Add salePrice column if it doesn't exist
    if (!hasSalePrice) {
      await queryRunner.query(`
        ALTER TABLE "products"
        ADD COLUMN "salePrice" decimal(10,2)
      `);
    }

    // Add salePriceExpiresAt column if it doesn't exist
    if (!hasSalePriceExpiresAt) {
      await queryRunner.query(`
        ALTER TABLE "products"
        ADD COLUMN "salePriceExpiresAt" TIMESTAMP
      `);
    }

    // Migrate existing price data to regularPrice for backward compatibility
    // Only update rows where regularPrice is NULL to avoid overwriting existing data
    await queryRunner.query(`
      UPDATE "products"
      SET "regularPrice" = "price"
      WHERE "regularPrice" IS NULL AND "price" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop salePriceExpiresAt column
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN "salePriceExpiresAt"
    `);

    // Drop salePrice column
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN "salePrice"
    `);

    // Drop regularPrice column
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN "regularPrice"
    `);
  }
}
