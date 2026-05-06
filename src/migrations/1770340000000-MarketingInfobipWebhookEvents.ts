import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Same timestamp as `AddMarketingContactTag1770340000000`; TypeORM orders ties by migration name
 * (`Add*` runs before `Marketing*`). Safe for PROD: creates tables only when missing.
 */
export class MarketingInfobipWebhookEvents1770340000000
  implements MigrationInterface
{
  name = 'MarketingInfobipWebhookEvents1770340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const del = await queryRunner.getTable('marketing_infobip_delivery_events');
    if (!del) {
      await queryRunner.query(`
        CREATE TABLE "marketing_infobip_delivery_events" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "messageId" character varying(128),
          "bulkId" character varying(128),
          "channel" character varying(32),
          "destination" character varying(40),
          "statusGroup" character varying(64),
          "statusName" character varying(128),
          "statusId" integer,
          "errorSummary" text,
          "sentAt" TIMESTAMP WITH TIME ZONE,
          "doneAt" TIMESTAMP WITH TIME ZONE,
          "rawPayload" jsonb NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_marketing_infobip_delivery_events" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_mi_delivery_messageId" ON "marketing_infobip_delivery_events" ("messageId")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mi_delivery_createdAt" ON "marketing_infobip_delivery_events" ("createdAt")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mi_delivery_destination" ON "marketing_infobip_delivery_events" ("destination")`,
      );
    }

    const inb = await queryRunner.getTable('marketing_infobip_inbound_messages');
    if (!inb) {
      await queryRunner.query(`
        CREATE TABLE "marketing_infobip_inbound_messages" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "messageId" character varying(128),
          "fromMsisdn" character varying(40),
          "toDestination" character varying(96),
          "channel" character varying(32),
          "textBody" text,
          "receivedAt" TIMESTAMP WITH TIME ZONE,
          "rawPayload" jsonb NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "PK_marketing_infobip_inbound_messages" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_mi_inbound_createdAt" ON "marketing_infobip_inbound_messages" ("createdAt")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mi_inbound_fromMsisdn" ON "marketing_infobip_inbound_messages" ("fromMsisdn")`,
      );
      await queryRunner.query(
        `CREATE UNIQUE INDEX "UQ_mi_inbound_messageId_nn" ON "marketing_infobip_inbound_messages" ("messageId") WHERE "messageId" IS NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const inb = await queryRunner.getTable('marketing_infobip_inbound_messages');
    if (inb) {
      await queryRunner.query(`DROP INDEX "UQ_mi_inbound_messageId_nn"`);
      await queryRunner.query(`DROP INDEX "IDX_mi_inbound_fromMsisdn"`);
      await queryRunner.query(`DROP INDEX "IDX_mi_inbound_createdAt"`);
      await queryRunner.query(`DROP TABLE "marketing_infobip_inbound_messages"`);
    }
    const del = await queryRunner.getTable('marketing_infobip_delivery_events');
    if (del) {
      await queryRunner.query(`DROP INDEX "IDX_mi_delivery_destination"`);
      await queryRunner.query(`DROP INDEX "IDX_mi_delivery_createdAt"`);
      await queryRunner.query(`DROP INDEX "IDX_mi_delivery_messageId"`);
      await queryRunner.query(`DROP TABLE "marketing_infobip_delivery_events"`);
    }
  }
}
