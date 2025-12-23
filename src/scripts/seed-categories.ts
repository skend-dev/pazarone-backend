import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CategoriesSeedService } from '../categories/categories-seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedService = app.get(CategoriesSeedService);

  try {
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
