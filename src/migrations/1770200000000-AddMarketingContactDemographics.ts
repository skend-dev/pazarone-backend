import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Optional profile fields for marketing audience (imports / admin).
 * `name` remains the full-name field; User sync does not wipe these when absent on User.
 */
export class AddMarketingContactDemographics1770200000000
  implements MigrationInterface
{
  name = 'AddMarketingContactDemographics1770200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'marketing_contacts' AND column_name = 'gender'
        ) THEN
          ALTER TABLE "marketing_contacts"
            ADD COLUMN "gender" character varying(64) NULL;
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'marketing_contacts' AND column_name = 'city'
        ) THEN
          ALTER TABLE "marketing_contacts"
            ADD COLUMN "city" character varying(256) NULL;
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'marketing_contacts' AND column_name = 'address'
        ) THEN
          ALTER TABLE "marketing_contacts"
            ADD COLUMN "address" text NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "marketing_contacts" DROP COLUMN IF EXISTS "address";
    `);
    await queryRunner.query(`
      ALTER TABLE "marketing_contacts" DROP COLUMN IF EXISTS "city";
    `);
    await queryRunner.query(`
      ALTER TABLE "marketing_contacts" DROP COLUMN IF EXISTS "gender";
    `);
  }
}
