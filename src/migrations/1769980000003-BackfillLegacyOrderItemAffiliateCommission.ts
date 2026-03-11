import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfills affiliateCommissionPercent for legacy order_items (created before the column existed).
 * Sets the current product's affiliateCommission as the snapshot. Note: for products whose
 * commission was changed after these orders were placed, this uses the current rate, not
 * the historical one (which we don't have).
 */
export class BackfillLegacyOrderItemAffiliateCommission1769980000003
  implements MigrationInterface
{
  name = 'BackfillLegacyOrderItemAffiliateCommission1769980000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "order_items" oi
      SET "affiliateCommissionPercent" = p."affiliateCommission"
      FROM "products" p
      WHERE oi."productId" = p.id
        AND oi."affiliateCommissionPercent" IS NULL
        AND p."affiliateCommission" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert by setting back to NULL - we cannot know which rows were backfilled vs originally set
    // This would clear ALL affiliateCommissionPercent, so we don't run a down by default.
    // If you need to roll back, run manually: UPDATE order_items SET "affiliateCommissionPercent" = NULL
    // where the migration's up() would have matched (null + product had commission).
  }
}
