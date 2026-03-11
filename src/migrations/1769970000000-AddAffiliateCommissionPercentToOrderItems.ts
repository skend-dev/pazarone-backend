import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds affiliateCommissionPercent to order_items - snapshot at order time.
 * DEPLOYMENT: Run this migration BEFORE deploying app code that uses this column.
 */
export class AddAffiliateCommissionPercentToOrderItems1769970000000
  implements MigrationInterface
{
  name = 'AddAffiliateCommissionPercentToOrderItems1769970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD COLUMN IF NOT EXISTS "affiliateCommissionPercent" decimal(5,2) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order_items"
      DROP COLUMN IF EXISTS "affiliateCommissionPercent"
    `);
  }
}
