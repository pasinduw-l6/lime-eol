import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { notificationConfig, NotificationConfig } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NOTIFICATION_CHANNEL,
  NotificationChannel,
} from '../ports/notification-channel.port';
import { EolChangeDetector } from './eol-change.detector';
import { EstateDetector } from './estate.detector';
import { toAdaptiveCard } from './event-card';
import { JiraDetector } from './jira.detector';
import { NotificationEvent } from './notification-event';
import { PlanDetector } from './plan.detector';

export interface DispatchResult {
  dryRun: boolean;
  found: number;
  skipped: number;
  sent: number;
  failed: number;
  events: NotificationEvent[];
}

@Injectable()
export class NotificationEventsService {
  private readonly logger = new Logger(NotificationEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly estate: EstateDetector,
    private readonly plans: PlanDetector,
    private readonly jira: JiraDetector,
    private readonly eolChanges: EolChangeDetector,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
    @Inject(notificationConfig.KEY) private readonly config: NotificationConfig,
  ) {}

  async daily(now = new Date()): Promise<DispatchResult> {
    const events = [
      ...(await this.eolChanges.detect(now)),
      ...(await this.jira.detect(now)),
      ...(await this.plans.detect(now)),
    ];

    return this.dispatch(events);
  }

  async weekly(now = new Date()): Promise<DispatchResult> {
    return this.dispatch(await this.estate.detect(now));
  }

  async preview(now = new Date()): Promise<NotificationEvent[]> {
    const events = await this.all(now);
    const seen = await this.alreadySent(events);
    return events.filter((event) => !seen.has(event.dedupKey));
  }

  async all(now = new Date()): Promise<NotificationEvent[]> {
    return [
      ...(await this.eolChanges.detect(now)),
      ...(await this.jira.detect(now)),
      ...(await this.plans.detect(now)),
      ...(await this.estate.detect(now)),
    ];
  }

  private async dispatch(
    events: NotificationEvent[],
  ): Promise<DispatchResult> {
    const seen = await this.alreadySent(events);
    const fresh = events.filter((event) => !seen.has(event.dedupKey));

    const result: DispatchResult = {
      dryRun: this.config.dryRun,
      found: events.length,
      skipped: events.length - fresh.length,
      sent: 0,
      failed: 0,
      events: fresh,
    };

    for (const event of fresh) {
      let error: string | null = null;

      try {
        await this.channel.sendRaw(event.title, toAdaptiveCard(event));
        result.sent += 1;
      } catch (caught) {
        error = caught instanceof Error ? caught.message : 'the send failed';
        result.failed += 1;
        this.logger.warn(`Could not post "${event.title}": ${error}`);
      }

      if (this.config.dryRun) {
        continue;
      }

      await this.prisma.notificationEvent.upsert({
        where: { dedupKey: event.dedupKey },
        update: { success: error === null, error, sentAt: new Date() },
        create: {
          kind: event.kind,
          subject: event.subject ?? null,
          dedupKey: event.dedupKey,
          channel: Channel.TEAMS,
          success: error === null,
          error,
        },
      });
    }

    return result;
  }

  private async alreadySent(
    events: NotificationEvent[],
  ): Promise<Set<string>> {
    if (events.length === 0) {
      return new Set();
    }

    const rows = await this.prisma.notificationEvent.findMany({
      where: {
        dedupKey: { in: events.map((event) => event.dedupKey) },
        success: true,
      },
      select: { dedupKey: true },
    });

    return new Set(rows.map((row) => row.dedupKey));
  }
}
