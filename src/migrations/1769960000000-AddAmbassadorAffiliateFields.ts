import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAmbassadorAffiliateFields1769960000000
  implements MigrationInterface
{
  name = 'AddAmbassadorAffiliateFields1769960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // users.referredByAffiliateId - ambassador who referred this seller
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "referredByAffiliateId" uuid NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_users_referredByAffiliateId') THEN
          ALTER TABLE "users"
          ADD CONSTRAINT "FK_users_referredByAffiliateId"
          FOREIGN KEY ("referredByAffiliateId") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_referredByAffiliateId"
      ON "users" ("referredByAffiliateId")
    `);

    // affiliate_referrals.isAmbassador
    await queryRunner.query(`
      ALTER TABLE "affiliate_referrals"
      ADD COLUMN IF NOT EXISTS "isAmbassador" boolean NOT NULL DEFAULT false
    `);

    // affiliate_referrals.buyerCommissionPercent - override for buyer referrals
    await queryRunner.query(`
      ALTER TABLE "affiliate_referrals"
      ADD COLUMN IF NOT EXISTS "buyerCommissionPercent" decimal(5,2) NULL
    `);

    // affiliate_referrals.sellerReferralCommissionPercent - % of platform fee for ambassador
    await queryRunner.query(`
      ALTER TABLE "affiliate_referrals"
      ADD COLUMN IF NOT EXISTS "sellerReferralCommissionPercent" decimal(5,2) NULL
    `);

    // affiliate_referrals.minWithdrawalThreshold - per-ambassador override
    await queryRunner.query(`
      ALTER TABLE "affiliate_referrals"
      ADD COLUMN IF NOT EXISTS "minWithdrawalThreshold" decimal(10,2) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_referredByAffiliateId"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP CONSTRAINT IF EXISTS "FK_users_referredByAffiliateId"
    `).catch(() => {});
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "referredByAffiliateId"
    `);

    await queryRunner.query(`
      ALTER TABLE "affiliate_referrals"
      DROP COLUMN IF EXISTS "minWithdrawalThreshold"
    `);
    await queryRunner.query(`
      ALTER TABLE "affiliate_referrals"
      DROP COLUMN IF EXISTS "sellerReferralCommissionPercent"
    `);
    await queryRunner.query(`
      ALTER TABLE "affiliate_referrals"
      DROP COLUMN IF EXISTS "buyerCommissionPercent"
    `);
    await queryRunner.query(`
      ALTER TABLE "affiliate_referrals"
      DROP COLUMN IF EXISTS "isAmbassador"
    `);
  }
}
