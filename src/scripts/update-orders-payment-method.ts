import { DataSource } from 'typeorm';

// Load environment variables - TypeORM scripts need this
// In NestJS apps, ConfigModule handles this, but standalone scripts need dotenv
if (!process.env.DATABASE_HOST) {
  // Only load dotenv if env vars aren't already set
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not available, assume env vars are set externally
    console.warn('Warning: dotenv not available. Ensure DATABASE_* env vars are set.');
  }
}

async function updateOrdersPaymentMethod() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'pazaro_db',
    // No entities needed - using raw SQL queries
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established');

    // Use raw SQL query to update orders directly - simpler and avoids entity metadata issues
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // First, count how many orders need updating
      const countResult = await queryRunner.query(
        'SELECT COUNT(*) as count FROM orders WHERE "paymentMethod" IS NULL',
      );
      const count = parseInt(countResult[0].count, 10);

      console.log(`Found ${count} orders with NULL paymentMethod`);

      if (count === 0) {
        console.log('No orders to update. Exiting...');
        await queryRunner.release();
        await dataSource.destroy();
        return;
      }

      // Update all orders to have paymentMethod = 'cod'
      // Since these are existing orders and we're treating NULL as COD (as per invoice logic),
      // we'll set them all to 'cod' by default
      const updateResult = await queryRunner.query(
        `UPDATE orders SET "paymentMethod" = 'cod' WHERE "paymentMethod" IS NULL`,
      );

      console.log(`Successfully updated ${count} orders to paymentMethod = 'cod'`);
    } finally {
      await queryRunner.release();
    }
    console.log('Update completed successfully!');

    await dataSource.destroy();
  } catch (error) {
    console.error('Error updating orders:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

// Run the script
updateOrdersPaymentMethod();

