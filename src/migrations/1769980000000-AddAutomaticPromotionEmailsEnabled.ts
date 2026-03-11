import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutomaticPromotionEmailsEnabled1769980000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('platform_settings');
    if (!table) return;

    const col = table.findColumnByName('automaticPromotionEmailsEnabled');
    if (col) return;

    await queryRunner.query(`
      ALTER TABLE "platform_settings"
      ADD COLUMN "automaticPromotionEmailsEnabled" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('platform_settings');
    if (!table) return;

    const col = table.findColumnByName('automaticPromotionEmailsEnabled');
    if (!col) return;

    await queryRunner.query(`
      ALTER TABLE "platform_settings"
      DROP COLUMN "automaticPromotionEmailsEnabled"
    `);
  }
}
