import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds two columns to `broadcasts`:
 *   - status  varchar(20) NOT NULL DEFAULT 'done'
 *     Tracks whether a manual broadcast is still sending ('processing'),
 *     completed ('done'), or crashed ('failed').
 *     All existing rows get 'done' immediately — zero downtime.
 *
 *   - totalRecipients  int NOT NULL DEFAULT 0
 *     Total number of users the job was started for, used for the
 *     progress-bar percentage on the admin UI.
 *
 * Both ALTER TABLE statements use DO $$ … $$ blocks so they are fully
 * idempotent (safe to run more than once) and never raise an error in
 * production even if a partial migration already ran.
 *
 * PostgreSQL guarantees that adding a NOT NULL column with a constant
 * DEFAULT is a metadata-only operation (no table rewrite) from v11 onwards,
 * so this migration completes instantly even on large tables.
 */
export class AddBroadcastStatusAndProgress1769980000005
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'broadcasts' AND column_name = 'status'
        ) THEN
          ALTER TABLE "broadcasts"
            ADD COLUMN "status" varchar(20) NOT NULL DEFAULT 'done';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'broadcasts' AND column_name = 'totalRecipients'
        ) THEN
          ALTER TABLE "broadcasts"
            ADD COLUMN "totalRecipients" int NOT NULL DEFAULT 0;
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
          WHERE table_name = 'broadcasts' AND column_name = 'status'
        ) THEN
          ALTER TABLE "broadcasts" DROP COLUMN "status";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'broadcasts' AND column_name = 'totalRecipients'
        ) THEN
          ALTER TABLE "broadcasts" DROP COLUMN "totalRecipients";
        END IF;
      END
      $$;
    `);
  }
}
