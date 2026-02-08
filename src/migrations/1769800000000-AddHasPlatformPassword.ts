import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHasPlatformPassword1769800000000 implements MigrationInterface {
  name = 'AddHasPlatformPassword1769800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PROD-SAFE: New column with DEFAULT true. All existing rows (email/password users) get true; no data loss.
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "hasPlatformPassword" boolean NOT NULL DEFAULT true
    `);
    // Only set false for users who have OAuth identities. Email-only users have no row in user_identities, so they keep true and normal login/signup keep working.
    await queryRunner.query(`
      UPDATE "users" u
      SET "hasPlatformPassword" = false
      WHERE EXISTS (SELECT 1 FROM "user_identities" ui WHERE ui."userId" = u."id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "hasPlatformPassword"
    `);
  }
}
