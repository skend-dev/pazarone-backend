import { MigrationInterface, QueryRunner } from 'typeorm';

export class MarketingViberInbound1770320000000 implements MigrationInterface {
  name = 'MarketingViberInbound1770320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.getTable('marketing_viber_inbounds');
    if (!exists) {
      await queryRunner.query(`
        CREATE TABLE "marketing_viber_inbounds" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "fromMsisdn" character varying(20),
          "businessSender" character varying(96),
          "textBody" text,
          "providerMessageId" character varying(96),
          "rawPayload" jsonb NOT NULL,
          "marketingContactId" uuid,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_marketing_viber_inbounds" PRIMARY KEY ("id"),
          CONSTRAINT "FK_mv_inbound_contact" FOREIGN KEY ("marketingContactId") REFERENCES "marketing_contacts" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_mv_inbound_fromMsisdn" ON "marketing_viber_inbounds" ("fromMsisdn")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mv_inbound_createdAt" ON "marketing_viber_inbounds" ("createdAt")`,
      );
      /** One row per Infobip message id when present; multiple NULLs allowed in PostgreSQL */
      await queryRunner.query(
        `CREATE UNIQUE INDEX "UQ_mv_inbound_providerMessageId" ON "marketing_viber_inbounds" ("providerMessageId")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const t = await queryRunner.getTable('marketing_viber_inbounds');
    if (t) {
      await queryRunner.query(`DROP INDEX "UQ_mv_inbound_providerMessageId"`);
      await queryRunner.query(`DROP INDEX "IDX_mv_inbound_createdAt"`);
      await queryRunner.query(`DROP INDEX "IDX_mv_inbound_fromMsisdn"`);
      await queryRunner.query(`DROP TABLE "marketing_viber_inbounds"`);
    }
  }
}
