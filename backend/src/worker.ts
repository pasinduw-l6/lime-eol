import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { waitForShutdownSignal } from './bootstrap/shutdown';
import { WorkerModule } from './worker.module';

async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Worker');

  app.enableShutdownHooks();

  logger.log('worker ready');
  logger.log(`Sync cron: ${config.getOrThrow<string>('SYNC_CRON')}`);
  logger.log(`Notify cron: ${config.getOrThrow<string>('NOTIFY_CRON')}`);
  logger.log(
    `Notifications enabled: ${config.getOrThrow<boolean>('NOTIFY_ENABLED')}`,
  );

  const signal = await waitForShutdownSignal();
  logger.log(`Received ${signal}, shutting down`);
  await app.close();
}

void bootstrapWorker();
