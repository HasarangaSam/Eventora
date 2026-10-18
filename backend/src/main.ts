import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const frontendOrigin = config.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173');
  const port = Number(config.get<string>('PORT', '3000'));

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, curl) or localhost 5173/5174
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1):(5173|5174)$/.test(origin) || origin === frontendOrigin) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for local dev
      }
    },
    credentials: true,
  });
  app.enableShutdownHooks();

  await app.listen(port);
}
await bootstrap();
