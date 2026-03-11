import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsAutomatedToBroadcasts1769980000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('broadcasts');
    if (!table) return;

    const col = table.findColumnByName('isAutomated');
    if (col) return;

    await queryRunner.query(`
      ALTER TABLE "broadcasts"
      ADD COLUMN "isAutomated" boolean NOT NULL DEFAULT false
    `);

    // Make createdById nullable for automated broadcasts
    await queryRunner.query(`
      ALTER TABLE "broadcasts"
      ALTER COLUMN "createdById" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('broadcasts');
    if (!table) return;

    const col = table.findColumnByName('isAutomated');
    if (col) {
      await queryRunner.query(`
        ALTER TABLE "broadcasts"
        DROP COLUMN "isAutomated"
      `);
    }
  }
}
