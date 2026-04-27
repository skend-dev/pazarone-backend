import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `promotionEmailScheduleDays` (jsonb, nullable) to `platform_settings`.
 *
 * Stores an array of weekday numbers (0=Sun … 6=Sat) used when
 * `promotionEmailSchedule = 'custom'`, e.g. [1,3,5] for Mon/Wed/Fri.
 * Null when the schedule mode is 'daily' or 'weekly'.
 *
 * Nullable columns require no DEFAULT, so this is a metadata-only ALTER on
 * PostgreSQL 11+ with no lock escalation.
 * Wrapped in DO $$ … $$ for full idempotency.
 */
export class AddPromotionEmailScheduleDays1769980000007
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'platform_settings'
            AND column_name = 'promotionEmailScheduleDays'
        ) THEN
          ALTER TABLE "platform_settings"
            ADD COLUMN "promotionEmailScheduleDays" jsonb NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'platform_settings'
            AND column_name = 'promotionEmailScheduleDays'
        ) THEN
          ALTER TABLE "platform_settings"
            DROP COLUMN "promotionEmailScheduleDays";
        END IF;
      END
      $$;
    `);
  }
}
