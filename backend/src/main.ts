import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const frontendOrigin = config.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173');
  const port = Number(config.get<string>('PORT', '3000'));

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  app.setGlobalPrefix('api');
  app.enableCors({ origin: frontendOrigin });
  app.enableShutdownHooks();

  await app.listen(port);
}
await bootstrap();
