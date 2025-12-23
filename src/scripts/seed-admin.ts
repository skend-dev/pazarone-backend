import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersSeedService } from '../users/users-seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedService = app.get(UsersSeedService);

  try {
    await seedService.seedAdmin();
    console.log('✅ Admin user seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
