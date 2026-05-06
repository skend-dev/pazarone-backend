import { MigrationInterface, QueryRunner } from 'typeorm';

export class MarketingViberDispatchesAndInfobip1770310000000
  implements MigrationInterface
{
  name = 'MarketingViberDispatchesAndInfobip1770310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableDisp = await queryRunner.getTable('marketing_viber_dispatches');
    if (!tableDisp) {
      await queryRunner.query(`
        CREATE TABLE "marketing_viber_dispatches" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "campaignId" uuid NOT NULL,
          "marketingContactId" uuid NOT NULL,
          "bulkId" character varying(64),
          "messageId" character varying(96),
          "destinationMsisdn" character varying(20) NOT NULL,
          "bucket" character varying(20) NOT NULL DEFAULT 'unknown',
          "providerStatusGroup" character varying(64),
          "providerStatusName" character varying(96),
          "rawLastReport" jsonb,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_marketing_viber_dispatches" PRIMARY KEY ("id"),
          CONSTRAINT "FK_mv_disp_campaign" FOREIGN KEY ("campaignId") REFERENCES "marketing_campaigns" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_mv_disp_contact" FOREIGN KEY ("marketingContactId") REFERENCES "marketing_contacts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_mv_disp_campaignId" ON "marketing_viber_dispatches" ("campaignId")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mv_disp_marketingContactId" ON "marketing_viber_dispatches" ("marketingContactId")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mv_disp_messageId" ON "marketing_viber_dispatches" ("messageId")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mv_disp_bulkId" ON "marketing_viber_dispatches" ("bulkId")`,
      );
    }

    const contactTable = await queryRunner.getTable('marketing_contacts');
    const hasSynced = contactTable?.columns.find(
      (c) => c.name === 'infobipPeopleSyncedAt',
    );
    if (!hasSynced) {
      await queryRunner.query(`
        ALTER TABLE "marketing_contacts"
        ADD COLUMN "infobipPeopleSyncedAt" TIMESTAMP WITH TIME ZONE NULL
      `);
      await queryRunner.query(`
        ALTER TABLE "marketing_contacts"
        ADD COLUMN "infobipPeopleSyncError" text NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableDisp = await queryRunner.getTable('marketing_viber_dispatches');
    if (tableDisp) {
      await queryRunner.query(`DROP INDEX "IDX_mv_disp_bulkId"`);
      await queryRunner.query(`DROP INDEX "IDX_mv_disp_messageId"`);
      await queryRunner.query(`DROP INDEX "IDX_mv_disp_marketingContactId"`);
      await queryRunner.query(`DROP INDEX "IDX_mv_disp_campaignId"`);
      await queryRunner.query(`DROP TABLE "marketing_viber_dispatches"`);
    }

    const contactAfter = await queryRunner.getTable('marketing_contacts');
    if (contactAfter?.columns.find((c) => c.name === 'infobipPeopleSyncError')) {
      await queryRunner.query(`
        ALTER TABLE "marketing_contacts" DROP COLUMN "infobipPeopleSyncError"
      `);
    }
    const contactFinal = await queryRunner.getTable('marketing_contacts');
    if (contactFinal?.columns.find((c) => c.name === 'infobipPeopleSyncedAt')) {
      await queryRunner.query(`
        ALTER TABLE "marketing_contacts" DROP COLUMN "infobipPeopleSyncedAt"
      `);
    }
  }
}
