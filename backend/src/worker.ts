import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { waitForShutdownSignal } from './bootstrap/shutdown';
import { EOL_CONFIG_KEY, EolConfig } from './config/namespaces/eol.config';
import {
  NOTIFICATION_CONFIG_KEY,
  NotificationConfig,
} from './config/namespaces/notification.config';
import { WorkerModule } from './worker.module';

async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const config = app.get(ConfigService);
  const eol = config.getOrThrow<EolConfig>(EOL_CONFIG_KEY);
  const notification = config.getOrThrow<NotificationConfig>(
    NOTIFICATION_CONFIG_KEY,
  );
  const logger = new Logger('Worker');

  app.enableShutdownHooks();

  logger.log('worker ready');
  logger.log(`EOL sync: ${eol.syncCron} (source ${eol.apiBase})`);
  logger.log(
    `Notifications: ${notification.enabled ? 'enabled' : 'disabled'} at ${notification.cron}`,
  );

  const signal = await waitForShutdownSignal();
  logger.log(`Received ${signal}, shutting down`);
  await app.close();
}

void bootstrapWorker();
