import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { AppConfig } from '../config/namespaces/app.config';

export function setupSecurity(app: INestApplication, config: AppConfig): void {
  app.use(helmet());
  app.enableCors({
    origin: config.baseUrl,
    credentials: true,
  });
}
