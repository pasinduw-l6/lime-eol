import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Request payload rules applied to every endpoint: unknown properties are
 * rejected rather than silently ignored, and payloads are transformed into
 * their DTO classes so types are real at runtime.
 */
export function setupValidation(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
}
