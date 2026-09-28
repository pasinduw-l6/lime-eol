import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { notificationConfig, NotificationConfig } from '../config';
import { NotificationsService } from '../modules/notifications/notifications.service';

@Injectable()
export class NotificationsJob {
  private readonly logger = new Logger(NotificationsJob.name);

  constructor(
    private readonly notifications: NotificationsService,
    @Inject(notificationConfig.KEY) private readonly config: NotificationConfig,
  ) {}

  @Cron(process.env['NOTIFY_CRON'] ?? '0 8 * * *', {
    name: 'notifications',
    timeZone: process.env['TZ'] ?? 'Asia/Colombo',
  })
  async run(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.debug('Skipped — NOTIFY_ENABLED is false.');
      return;
    }

    const result = await this.notifications.run();

    this.logger.log(
      `${result.dryRun ? '[dry run] ' : ''}` +
        `${result.found} due, ${result.skipped} already announced, ` +
        `${result.sent} sent, ${result.failed} failed` +
        `${result.asDigest ? ' (as a digest)' : ''}`,
    );
  }
}
