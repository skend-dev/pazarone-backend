import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * External image tracking for imported products.
 * Safe for production: additive columns with defaults, idempotent enum/column/index creation.
 */
export class AddProductExternalImageFields1770400000000
  implements MigrationInterface
{
  name = 'AddProductExternalImageFields1770400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "product_image_source_enum" AS ENUM ('uploaded', 'external');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "product_external_image_status_enum" AS ENUM ('healthy', 'broken', 'resolved');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "imageSource" "product_image_source_enum" NOT NULL DEFAULT 'uploaded'
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "externalImageStatus" "product_external_image_status_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "brokenImageUrls" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "externalImageIssueAt" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "externalImageResolvedAt" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "importSource" varchar(32)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_externalImageStatus"
      ON "products" ("externalImageStatus")
      WHERE "imageSource" = 'external'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_products_externalImageStatus"
    `);

    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "importSource"
    `);
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "externalImageResolvedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "externalImageIssueAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "brokenImageUrls"
    `);
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "externalImageStatus"
    `);
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "imageSource"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "product_external_image_status_enum"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "product_image_source_enum"
    `);
  }
}
