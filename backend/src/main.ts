import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSecurity } from './bootstrap/security.setup';
import { SWAGGER_PATH, setupSwagger } from './bootstrap/swagger.setup';
import { setupValidation } from './bootstrap/validation.setup';
import { APP_CONFIG_KEY, AppConfig } from './config/namespaces/app.config';
import { AUTH_CONFIG_KEY, AuthConfig } from './config/namespaces/auth.config';

const API_PREFIX = 'api/v1';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const appConfig = config.getOrThrow<AppConfig>(APP_CONFIG_KEY);
  const authConfig = config.getOrThrow<AuthConfig>(AUTH_CONFIG_KEY);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix(API_PREFIX);
  setupSecurity(app, appConfig);
  setupValidation(app);
  setupSwagger(app);
  app.enableShutdownHooks();

  await app.listen(appConfig.port, '0.0.0.0');

  logger.log(`API ready on http://localhost:${appConfig.port}/${API_PREFIX}`);
  logger.log(`Swagger ready on http://localhost:${appConfig.port}/${SWAGGER_PATH}`);
  logger.log(`Auth mode: ${authConfig.mode}`);
}

void bootstrap();
