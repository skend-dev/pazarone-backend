import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `promotionEmailScheduleSlots` (jsonb, nullable) to `platform_settings`.
 *
 * Stores per-day send-time pairs for the 'custom' schedule mode:
 *   [{day:1,hour:9},{day:3,hour:14},{day:5,hour:18}]
 *   = Mon 9 AM, Wed 2 PM, Fri 6 PM (Europe/Skopje)
 *
 * The existing `promotionEmailScheduleDays` column is retained for
 * backward compatibility but is no longer written by the application.
 *
 * Nullable column → no DEFAULT needed → metadata-only ALTER (no rewrite/lock).
 * Wrapped in DO $$ … $$ for full idempotency.
 */
export class AddPromotionEmailScheduleSlots1769980000008
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'platform_settings'
            AND column_name = 'promotionEmailScheduleSlots'
        ) THEN
          ALTER TABLE "platform_settings"
            ADD COLUMN "promotionEmailScheduleSlots" jsonb NULL;
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
            AND column_name = 'promotionEmailScheduleSlots'
        ) THEN
          ALTER TABLE "platform_settings"
            DROP COLUMN "promotionEmailScheduleSlots";
        END IF;
      END
      $$;
    `);
  }
}
