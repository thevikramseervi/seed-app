import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const isProd = process.env.NODE_ENV === 'production';

  // Security headers
  app.use(helmet());

  // Enable CORS — allow the Netlify frontend and local dev server.
  // FRONTEND_URL may be a comma-separated list of allowed origins, e.g.:
  //   https://myapp.netlify.app
  //   https://myapp.netlify.app,https://custom-domain.com
  const allowedOrigins = new Set(['http://localhost:5173', 'http://localhost:3000']);
  if (process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL
      .split(',')
      .map((u) => u.trim().replace(/\/$/, ''))
      .filter(Boolean)
      .forEach((u) => allowedOrigins.add(u));
  }
  const logger2 = new Logger('CORS');
  logger2.log(`Allowed origins: ${[...allowedOrigins].join(', ')}`);
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      logger2.warn(`Blocked CORS request from: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger documentation — only in non-production environments
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('Attend Ease API')
      .setDescription('Automated Attendance and Payroll Management System')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`API Documentation: http://localhost:${process.env.PORT || 3000}/api/docs`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application is running on port ${port}`);
}

bootstrap();
