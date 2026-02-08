import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIdentitiesAndOAuthFields1769700000000
  implements MigrationInterface
{
  name = 'AddUserIdentitiesAndOAuthFields1769700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "avatarUrl" varchar NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "email" DROP NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "user_identities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "provider" varchar(20) NOT NULL,
        "providerUid" varchar(128) NOT NULL,
        "email" varchar NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_identities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_identities_provider_providerUid" UNIQUE ("provider", "providerUid"),
        CONSTRAINT "FK_user_identities_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_user_identities_userId" ON "user_identities" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_identities_provider_providerUid" ON "user_identities" ("provider", "providerUid")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_identities"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "avatarUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "email" SET NOT NULL
    `);
  }
}
