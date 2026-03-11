import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromotionEmailSchedule1769980000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('platform_settings');
    if (!table) return;

    const scheduleCol = table.findColumnByName('promotionEmailSchedule');
    if (!scheduleCol) {
      await queryRunner.query(`
        ALTER TABLE "platform_settings"
        ADD COLUMN "promotionEmailSchedule" varchar(20) NOT NULL DEFAULT 'daily'
      `);
    }

    const dayCol = table.findColumnByName('promotionEmailScheduleDayOfWeek');
    if (!dayCol) {
      await queryRunner.query(`
        ALTER TABLE "platform_settings"
        ADD COLUMN "promotionEmailScheduleDayOfWeek" integer NOT NULL DEFAULT 1
      `);
    }

    const flashCol = table.findColumnByName('promotionEmailsFlashDealsEnabled');
    if (!flashCol) {
      await queryRunner.query(`
        ALTER TABLE "platform_settings"
        ADD COLUMN "promotionEmailsFlashDealsEnabled" boolean NOT NULL DEFAULT true
      `);
    }

    const newCol = table.findColumnByName('promotionEmailsNewArrivalsEnabled');
    if (!newCol) {
      await queryRunner.query(`
        ALTER TABLE "platform_settings"
        ADD COLUMN "promotionEmailsNewArrivalsEnabled" boolean NOT NULL DEFAULT true
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('platform_settings');
    if (!table) return;

    const cols = [
      'promotionEmailSchedule',
      'promotionEmailScheduleDayOfWeek',
      'promotionEmailsFlashDealsEnabled',
      'promotionEmailsNewArrivalsEnabled',
    ];
    for (const colName of cols) {
      const col = table.findColumnByName(colName);
      if (col) {
        await queryRunner.query(
          `ALTER TABLE "platform_settings" DROP COLUMN "${colName}"`,
        );
      }
    }
  }
}
