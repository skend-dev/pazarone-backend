import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBroadcastsTable1769600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: skip if table already exists (safe for prod re-runs)
    const table = await queryRunner.getTable('broadcasts');
    if (table) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "broadcasts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar(120) NOT NULL,
        "message" text NOT NULL,
        "targetAudience" jsonb NOT NULL,
        "deliveryMethod" varchar(20) NOT NULL,
        "featuredProductIds" jsonb,
        "emailSent" integer NOT NULL DEFAULT 0,
        "notificationsCreated" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdById" uuid NOT NULL,
        CONSTRAINT "PK_broadcasts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_broadcasts_createdById" FOREIGN KEY ("createdById") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_broadcasts_createdById" ON "broadcasts" ("createdById")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_broadcasts_createdAt" ON "broadcasts" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Safe: only drop if table exists; dropping table removes its indexes
    const table = await queryRunner.getTable('broadcasts');
    if (!table) {
      return;
    }
    await queryRunner.query(`DROP TABLE "broadcasts"`);
  }
}
