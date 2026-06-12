import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Broadcast recipient log + campaign audience fields.
 * Safe for production: idempotent table/column/index creation.
 */
export class AddBroadcastRecipients1770600000000 implements MigrationInterface {
  name = 'AddBroadcastRecipients1770600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "broadcast_recipients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "broadcastId" uuid NOT NULL,
        "email" character varying(255) NOT NULL,
        "emailNormalized" character varying(255) NOT NULL,
        "name" character varying(120),
        "userId" uuid,
        "channel" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL,
        "sentAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_broadcast_recipients" PRIMARY KEY ("id"),
        CONSTRAINT "FK_broadcast_recipients_broadcast" FOREIGN KEY ("broadcastId") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_broadcast_recipients_broadcastId"
      ON "broadcast_recipients" ("broadcastId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_broadcast_recipients_broadcastId_emailNormalized"
      ON "broadcast_recipients" ("broadcastId", "emailNormalized")
    `);

    let broadcasts = await queryRunner.getTable('broadcasts');
    if (broadcasts && !broadcasts.findColumnByName('audienceGender')) {
      await queryRunner.query(
        `ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "audienceGender" character varying(10)`,
      );
    }

    broadcasts = await queryRunner.getTable('broadcasts');
    if (broadcasts && !broadcasts.findColumnByName('sourceBroadcastId')) {
      await queryRunner.query(
        `ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "sourceBroadcastId" uuid`,
      );
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "broadcasts"
          ADD CONSTRAINT "FK_broadcasts_sourceBroadcastId"
          FOREIGN KEY ("sourceBroadcastId") REFERENCES "broadcasts"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
    }

    broadcasts = await queryRunner.getTable('broadcasts');
    if (broadcasts && !broadcasts.findColumnByName('campaignRootId')) {
      await queryRunner.query(
        `ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "campaignRootId" uuid`,
      );
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_broadcasts_campaignRootId"
        ON "broadcasts" ("campaignRootId")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "broadcast_recipients" CASCADE`);

    const broadcasts = await queryRunner.getTable('broadcasts');
    if (broadcasts?.findColumnByName('campaignRootId')) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_broadcasts_campaignRootId"`);
      await queryRunner.query(
        `ALTER TABLE "broadcasts" DROP COLUMN IF EXISTS "campaignRootId"`,
      );
    }
    if (broadcasts?.findColumnByName('sourceBroadcastId')) {
      await queryRunner.query(
        `ALTER TABLE "broadcasts" DROP CONSTRAINT IF EXISTS "FK_broadcasts_sourceBroadcastId"`,
      );
      await queryRunner.query(
        `ALTER TABLE "broadcasts" DROP COLUMN IF EXISTS "sourceBroadcastId"`,
      );
    }
    if (broadcasts?.findColumnByName('audienceGender')) {
      await queryRunner.query(
        `ALTER TABLE "broadcasts" DROP COLUMN IF EXISTS "audienceGender"`,
      );
    }
  }
}
