import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds fine-grained automation options to `platform_settings`:
 *
 *   promotionEmailSendHour       int     DEFAULT 9
 *     Hour (0–23, Europe/Skopje) at which automated emails fire.
 *     Previously hardcoded to 9; now configurable without redeployment.
 *
 *   promotionEmailMaxProducts    int     DEFAULT 8
 *     Cap on how many products appear in each automated email.
 *
 *   promotionEmailTargetCustomers  bool  DEFAULT true
 *   promotionEmailTargetSellers    bool  DEFAULT true
 *   promotionEmailTargetAffiliates bool  DEFAULT true
 *     Per-group audience toggles. Allows sending only to specific
 *     user types without disabling the whole campaign.
 *
 * All statements use DO $$ … $$ blocks for full idempotency.
 * Adding NOT NULL columns with constant DEFAULTs is metadata-only
 * in PostgreSQL 11+ (no table rewrite, no lock escalation).
 */
export class AddPromotionEmailOptions1769980000006
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: Array<{ name: string; definition: string }> = [
      { name: 'promotionEmailSendHour', definition: 'int NOT NULL DEFAULT 9' },
      {
        name: 'promotionEmailMaxProducts',
        definition: 'int NOT NULL DEFAULT 8',
      },
      {
        name: 'promotionEmailTargetCustomers',
        definition: 'boolean NOT NULL DEFAULT true',
      },
      {
        name: 'promotionEmailTargetSellers',
        definition: 'boolean NOT NULL DEFAULT true',
      },
      {
        name: 'promotionEmailTargetAffiliates',
        definition: 'boolean NOT NULL DEFAULT true',
      },
    ];

    for (const col of columns) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'platform_settings'
              AND column_name = '${col.name}'
          ) THEN
            ALTER TABLE "platform_settings"
              ADD COLUMN "${col.name}" ${col.definition};
          END IF;
        END
        $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = [
      'promotionEmailSendHour',
      'promotionEmailMaxProducts',
      'promotionEmailTargetCustomers',
      'promotionEmailTargetSellers',
      'promotionEmailTargetAffiliates',
    ];

    for (const name of names) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'platform_settings'
              AND column_name = '${name}'
          ) THEN
            ALTER TABLE "platform_settings" DROP COLUMN "${name}";
          END IF;
        END
        $$;
      `);
    }
  }
}
