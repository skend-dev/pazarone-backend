import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductViews1768749200000 implements MigrationInterface {
  name = 'AddProductViews1768749200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products" 
      ADD COLUMN "views" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products" 
      DROP COLUMN "views"
    `);
  }
}
