import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Note: Install helmet with: npm install helmet
// For now, using a conditional import that will work once installed
let helmet: any;
try {
  helmet = require('helmet');
} catch (e) {
  // Helmet not installed, will need to be installed for production
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  // Security: Helmet for HTTP headers protection
  // Install with: npm install helmet
  if (helmet) {
    app.use(helmet.default());
    logger.log('Helmet security headers enabled');
  } else {
    logger.warn('⚠️  Helmet not installed. Install with: npm install helmet');
  }

  // Enable CORS
  const corsOrigin = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:3000',
  );

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

  // Global exception filter for consistent error handling
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable validation pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
    }),
  );

  // Swagger configuration - only enable in non-production environments
  if (!isProduction) {
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
    logger.log(`Swagger documentation available at: http://localhost:${configService.get<number>('PORT', 3001)}/api/docs`);
  } else {
    logger.warn('Swagger is disabled in production for security reasons');
  }

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`CORS Origin: ${isProduction ? corsOrigin : 'All origins (development)'}`);
}
bootstrap();
