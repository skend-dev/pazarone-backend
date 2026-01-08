import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1767895229024 implements MigrationInterface {
    name = 'InitialMigration1767895229024'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "exchangeRate" SET DEFAULT '61.5'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "exchangeRate" SET DEFAULT 61.5`);
    }

}
