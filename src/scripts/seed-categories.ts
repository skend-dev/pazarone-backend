import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CategoriesSeedService } from '../categories/categories-seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedService = app.get(CategoriesSeedService);

  try {
    // Check if --clear flag is provided for re-seeding
    const shouldClear = process.argv.includes('--clear') || process.argv.includes('-c');
    
    if (shouldClear) {
      console.log('🗑️  Clearing existing categories...');
      await seedService.clear();
      console.log('✅ Categories cleared.');
    }

    await seedService.seed();
    console.log('✅ Category seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
