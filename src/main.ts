import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS
  const corsOrigin = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:3000',
  );
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  app.enableCors({
    origin:
      nodeEnv === 'development'
        ? true // Allow all origins in development
        : corsOrigin, // Use specific origin in production
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token', // Required for CSRF protection in authenticated requests
    ],
    exposedHeaders: [
      'Content-Range',
      'X-Content-Range',
      'X-CSRF-Token', // Expose CSRF token to frontend
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Enable validation pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('PazarOne Backend API')
    .setDescription('Backend API for PazarOne marketplace - Seller endpoints')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('products', 'Public product endpoints (no authentication required)')
    .addTag('orders', 'Customer order endpoints (authentication required)')
    .addTag('seller-dashboard', 'Seller dashboard endpoints')
    .addTag('seller-products', 'Seller product management endpoints')
    .addTag('seller-orders', 'Seller order management endpoints')
    .addTag('seller-analytics', 'Seller analytics endpoints')
    .addTag('seller-settings', 'Seller settings endpoints')
    .addTag('seller-performance', 'Seller performance metrics endpoints')
    .addTag('categories', 'Category endpoints (public)')
    .addTag('upload', 'File upload endpoints (Cloudinary)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
}
bootstrap();
