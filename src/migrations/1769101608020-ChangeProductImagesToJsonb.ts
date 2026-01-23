import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeProductImagesToJsonb1769101608020
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add a temporary jsonb column
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD COLUMN "images_temp" jsonb
    `);

    // Step 2: Convert existing text data to jsonb format
    // Handle different formats:
    // - null -> null
    // - JSON string array -> parse and store as jsonb
    // - Single URL string -> wrap in array
    // - Empty string -> null
    await queryRunner.query(`
      UPDATE products
      SET images_temp = CASE
        WHEN images IS NULL OR images = '' THEN NULL
        WHEN images LIKE '[%' THEN images::jsonb
        ELSE jsonb_build_array(images)
      END
    `);

    // Step 3: Drop the old text column
    await queryRunner.query(`
      ALTER TABLE "products"
      DROP COLUMN "images"
    `);

    // Step 4: Rename the temporary column to images
    await queryRunner.query(`
      ALTER TABLE "products"
      RENAME COLUMN "images_temp" TO "images"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Convert jsonb back to text
    // Convert array to JSON string, or null to empty string
    await queryRunner.query(`
      ALTER TABLE "products"
      ALTER COLUMN "images" TYPE text
      USING CASE
        WHEN images IS NULL THEN NULL
        ELSE images::text
      END
    `);
  }
}
