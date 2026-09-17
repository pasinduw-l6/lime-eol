import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SWAGGER_PATH, setupSwagger } from './bootstrap/swagger.setup';

const API_PREFIX = 'api/v1';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({
    origin: config.getOrThrow<string>('APP_BASE_URL'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  setupSwagger(app);

  const port = config.getOrThrow<number>('API_PORT');
  await app.listen(port, '0.0.0.0');

  logger.log(`API ready on http://localhost:${port}/${API_PREFIX}`);
  logger.log(`Swagger ready on http://localhost:${port}/${SWAGGER_PATH}`);
  logger.log(`Auth mode: ${config.getOrThrow<string>('AUTH_MODE')}`);
}

void bootstrap();
