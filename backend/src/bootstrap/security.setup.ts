import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { AppConfig } from '../config/namespaces/app.config';

/**
 * HTTP hardening: secure headers and a CORS policy limited to the web app.
 * Rate limiting on auth endpoints joins this in Phase 11.
 */
export function setupSecurity(app: INestApplication, config: AppConfig): void {
  app.use(helmet());
  app.enableCors({
    origin: config.baseUrl,
    credentials: true,
  });
}
