import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductShippingFields1769950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    let table = await queryRunner.getTable('products');
    if (!table?.findColumnByName('shippingType')) {
      await queryRunner.query(`
        ALTER TABLE "products"
        ADD COLUMN "shippingType" varchar(10)
      `);
    }
    table = await queryRunner.getTable('products');
    if (!table?.findColumnByName('shippingPriceNorthMacedonia')) {
      await queryRunner.query(`
        ALTER TABLE "products"
        ADD COLUMN "shippingPriceNorthMacedonia" decimal(10,2)
      `);
    }
    table = await queryRunner.getTable('products');
    if (!table?.findColumnByName('shippingPriceKosovo')) {
      await queryRunner.query(`
        ALTER TABLE "products"
        ADD COLUMN "shippingPriceKosovo" decimal(10,2)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "shippingPriceKosovo"
    `);
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "shippingPriceNorthMacedonia"
    `);
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "shippingType"
    `);
  }
}
