import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Canonical marketing audience contacts: registered users (optional userId) and imports.
 * Partial unique indexes enforce dedupe by user, email, or E.164 phone.
 */
export class AddMarketingContacts1770100000000 implements MigrationInterface {
  name = 'AddMarketingContacts1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_contacts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NULL,
        "source" character varying(20) NOT NULL,
        "email" character varying NULL,
        "phoneE164" character varying NULL,
        "name" character varying NULL,
        "market" character varying(10) NULL,
        "userType" character varying(32) NULL,
        "emailMarketingOptIn" boolean NOT NULL DEFAULT false,
        "viberMarketingOptIn" boolean NOT NULL DEFAULT false,
        "emailSuppressedAt" TIMESTAMP WITH TIME ZONE NULL,
        "viberSuppressedAt" TIMESTAMP WITH TIME ZONE NULL,
        "metadata" jsonb NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_contacts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_marketing_contacts_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marketing_contacts_userId"
        ON "marketing_contacts" ("userId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marketing_contacts_source"
        ON "marketing_contacts" ("source");
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_contacts_userId_not_null"
        ON "marketing_contacts" ("userId")
        WHERE "userId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_contacts_email_lower"
        ON "marketing_contacts" (lower("email"))
        WHERE "email" IS NOT NULL AND trim("email") <> '';
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_contacts_phone_e164"
        ON "marketing_contacts" ("phoneE164")
        WHERE "phoneE164" IS NOT NULL AND trim("phoneE164") <> '';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_marketing_contacts_phone_e164"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_marketing_contacts_email_lower"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_marketing_contacts_userId_not_null"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_marketing_contacts_source"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_marketing_contacts_userId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_contacts"`);
  }
}
