import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { notificationConfig, NotificationConfig } from '../config';
import { NotificationEventsService } from '../modules/notifications/events/notification-events.service';

/**
 * Two passes, because they answer different questions.
 *
 * The daily one reports what changed - a date moved, an issue progressed, a
 * plan slipped. The weekly one reports where things stand whether or not
 * anything changed, which is what makes a quiet week distinguishable from a
 * broken job.
 */
@Injectable()
export class NotificationEventsJob {
  private readonly logger = new Logger(NotificationEventsJob.name);

  constructor(
    private readonly events: NotificationEventsService,
    @Inject(notificationConfig.KEY) private readonly config: NotificationConfig,
  ) {}

  @Cron(process.env['NOTIFY_EVENTS_CRON'] ?? '0 11 * * *', {
    name: 'notification-events',
    timeZone: process.env['TZ'] ?? 'Asia/Colombo',
  })
  async daily(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.debug('Skipped — NOTIFY_ENABLED is false.');
      return;
    }

    const result = await this.events.daily();
    this.report('daily', result);
  }

  @Cron(process.env['NOTIFY_DIGEST_CRON'] ?? '0 9 * * 1', {
    name: 'notification-digest',
    timeZone: process.env['TZ'] ?? 'Asia/Colombo',
  })
  async weekly(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const result = await this.events.weekly();
    this.report('weekly digest', result);
  }

  private report(
    pass: string,
    result: { dryRun: boolean; found: number; skipped: number; sent: number; failed: number },
  ): void {
    this.logger.log(
      `${result.dryRun ? '[dry run] ' : ''}${pass}: ` +
        `${result.found} found, ${result.skipped} already announced, ` +
        `${result.sent} sent, ${result.failed} failed`,
    );
  }
}
