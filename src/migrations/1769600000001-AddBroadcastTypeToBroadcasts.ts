import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBroadcastTypeToBroadcasts1769600000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('broadcasts');
    if (!table) return;

    const col = table.findColumnByName('broadcastType');
    if (col) return;

    await queryRunner.query(`
      ALTER TABLE "broadcasts"
      ADD COLUMN "broadcastType" varchar(40) NOT NULL DEFAULT 'general_announcement'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('broadcasts');
    if (!table) return;

    const col = table.findColumnByName('broadcastType');
    if (!col) return;

    await queryRunner.query(`
      ALTER TABLE "broadcasts"
      DROP COLUMN "broadcastType"
    `);
  }
}
