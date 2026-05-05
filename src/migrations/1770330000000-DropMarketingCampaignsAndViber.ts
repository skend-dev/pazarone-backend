import { MigrationInterface, QueryRunner } from 'typeorm';

/** Removes in-app campaign + Viber delivery tracking — audience + Infobip People only */
export class DropMarketingCampaignsAndViber1770330000000
  implements MigrationInterface
{
  name = 'DropMarketingCampaignsAndViber1770330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "marketing_viber_inbounds" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "marketing_viber_dispatches" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_campaigns" CASCADE`);
  }

  public async down(): Promise<void> {
    /** Recreate prior schema via restore / re-deploy; not reversible here. */
  }
}
