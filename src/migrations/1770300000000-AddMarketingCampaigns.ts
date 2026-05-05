import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarketingCampaigns1770300000000 implements MigrationInterface {
  name = 'AddMarketingCampaigns1770300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.getTable('marketing_campaigns');
    if (existing) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "marketing_campaigns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(120) NOT NULL,
        "message" text NOT NULL,
        "audienceFilters" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "channels" jsonb NOT NULL DEFAULT '{"email":false,"notification":false,"viber":false}'::jsonb,
        "emailSent" integer NOT NULL DEFAULT '0',
        "notificationsCreated" integer NOT NULL DEFAULT '0',
        "viberSent" integer NOT NULL DEFAULT '0',
        "viberFailed" integer NOT NULL DEFAULT '0',
        "emailFailed" integer NOT NULL DEFAULT '0',
        "totalRecipients" integer NOT NULL DEFAULT '0',
        "status" character varying(20) NOT NULL DEFAULT 'done',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdById" uuid,
        CONSTRAINT "PK_marketing_campaigns" PRIMARY KEY ("id"),
        CONSTRAINT "FK_marketing_campaigns_createdBy" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_marketing_campaigns_createdById" ON "marketing_campaigns" ("createdById")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_marketing_campaigns_createdAt" ON "marketing_campaigns" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('marketing_campaigns');
    if (!table) {
      return;
    }

    await queryRunner.query(`DROP INDEX "IDX_marketing_campaigns_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_marketing_campaigns_createdById"`);
    await queryRunner.query(`DROP TABLE "marketing_campaigns"`);
  }
}
