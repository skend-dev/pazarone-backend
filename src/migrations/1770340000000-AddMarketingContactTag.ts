import { MigrationInterface, QueryRunner } from 'typeorm';

/** Shares timestamp `1770340000000` with MarketingInfobipWebhookEvents; TypeORM runs this first (name order). */
export class AddMarketingContactTag1770340000000 implements MigrationInterface {
  name = 'AddMarketingContactTag1770340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "marketing_contacts"
      ADD COLUMN IF NOT EXISTS "tag" character varying(128) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "marketing_contacts" DROP COLUMN IF EXISTS "tag"
    `);
  }
}
