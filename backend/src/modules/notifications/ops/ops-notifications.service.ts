import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { appConfig, AppConfig, notificationConfig, NotificationConfig } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EolSyncService, SyncResult } from '../../eol-sync/eol-sync.service';
import { toAdaptiveCard } from '../events/event-card';
import {
  EventMention,
  NotificationEvent,
  Severity,
} from '../events/notification-event';
import { NotificationEventsService } from '../events/notification-events.service';
import { buildDeadlineCard } from '../notifications.renderer';
import { NotificationsService } from '../notifications.service';
import {
  NOTIFICATION_CHANNEL,
  NotificationChannel,
} from '../ports/notification-channel.port';
import { CustomMessageDto } from './custom-message.dto';

export type Pass = 'eol' | 'events' | 'digest';

/** What the bearer token carries - the display name is not in it. */
export interface Actor {
  id: string;
  email: string;
}

interface Sender {
  email: string;
  name: string;
}

/** One thing the page can send, as a row with a button next to it. */
export interface Sendable {
  key: string;
  group: string;
  title: string;
  subtitle: string;
  severity: Severity;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'the send failed';
}

/**
 * What the operations page can do that the schedule cannot.
 *
 * Two things, both deliberate exceptions to how the automatic messages behave:
 * a message typed by a person is never deduplicated, because saying it twice is
 * a decision rather than a fault; and any scheduled pass can be forced, which
 * clears what has already been announced so it is announced again.
 */
@Injectable()
export class OpsNotificationsService {
  private readonly logger = new Logger(OpsNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: NotificationEventsService,
    private readonly deadlines: NotificationsService,
    private readonly eolSync: EolSyncService,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
    @Inject(notificationConfig.KEY) private readonly config: NotificationConfig,
  ) {}

  /** Renders the card without sending or recording anything. */
  async preview(
    input: CustomMessageDto,
    actor: Actor,
  ): Promise<Record<string, unknown>> {
    const event = await this.toEvent(input, await this.senderOf(actor));
    return toAdaptiveCard(event);
  }

  async send(
    input: CustomMessageDto,
    actor: Actor,
  ): Promise<{ sent: boolean; error: string | null; dryRun: boolean }> {
    const sender = await this.senderOf(actor);
    const event = await this.toEvent(input, sender);

    let error: string | null = null;
    try {
      await this.channel.sendRaw(event.title, toAdaptiveCard(event));
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'the send failed';
      this.logger.warn(`Could not post "${event.title}": ${error}`);
    }

    // Recorded even on a dry run, unlike the automatic messages. The key is
    // unique per send, so writing it silences nothing - it is an audit trail of
    // who posted what to the channel, which a broadcast tool needs.
    await this.prisma.notificationEvent.create({
      data: {
        kind: 'manual.custom',
        subject: actor.id,
        dedupKey: event.dedupKey,
        channel: Channel.TEAMS,
        success: error === null,
        error,
      },
    });

    return { sent: error === null, error, dryRun: this.config.dryRun };
  }

  /**
   * Runs a scheduled pass now.
   *
   * With `force`, whatever that pass has already announced is forgotten first,
   * so it says it again. That is the point of the button: the team missed it,
   * or something has made an old warning relevant again.
   */
  async run(pass: Pass, force: boolean): Promise<unknown> {
    if (force) {
      await this.clearSuppression(pass);
    }

    switch (pass) {
      case 'eol':
        return this.deadlines.run();
      case 'digest':
        return this.events.weekly();
      default:
        return this.events.daily();
    }
  }

  /** What has been announced, newest first, across both records. */
  async history(limit = 50) {
    const [events, deadlines] = await Promise.all([
      this.prisma.notificationEvent.findMany({
        orderBy: { sentAt: 'desc' },
        take: limit,
      }),
      this.deadlines.log(limit),
    ]);

    const senders = await this.prisma.appUser.findMany({
      where: {
        id: {
          in: events
            .filter((event) => event.kind === 'manual.custom' && event.subject)
            .map((event) => event.subject as string),
        },
      },
    });

    return {
      events: events.map((event) => ({
        kind: event.kind,
        subject: event.subject,
        dedupKey: event.dedupKey,
        success: event.success,
        error: event.error,
        sentAt: event.sentAt.toISOString(),
        sentBy:
          senders.find((user) => user.id === event.subject)?.displayName ?? null,
      })),
      deadlines,
    };
  }

  /** Lets a pass announce something it has already announced. */
  async clearSuppression(pass: Pass): Promise<{ cleared: number }> {
    if (pass === 'eol') {
      const { count } = await this.prisma.notificationLog.deleteMany({});
      return { cleared: count };
    }

    const kinds =
      pass === 'digest'
        ? ['estate.weekly']
        : [
            'jira.raised',
            'jira.in-progress',
            'jira.done',
            'jira.sync-failing',
            'plan.overdue',
            'eol.date-moved',
            'eol.unmaintained',
          ];

    const { count } = await this.prisma.notificationEvent.deleteMany({
      where: { kind: { in: kinds } },
    });

    return { cleared: count };
  }

  /**
   * Sends everything there is to say, and records none of it.
   *
   * For demonstrations. The scheduled passes are built to say each thing once,
   * which is right in a channel people read every day and wrong in front of an
   * audience - where the second run going quiet looks like a broken tool.
   * Nothing is written to either log, so this neither silences a real
   * announcement nor pretends one already happened.
   */
  async available(): Promise<Sendable[]> {
    const items: Sendable[] = [];

    // Every cycle past or near end of life, ignoring what has been announced.
    for (const due of await this.deadlines.due()) {
      items.push({
        key: `eol:${due.cycleId}`,
        group: due.days <= 0 ? 'Past end of life' : 'Ending soon',
        title: `${due.technology} ${due.cycle}`,
        subtitle: `${[...new Set(due.environments)].join(', ')}`,
        severity: due.days <= 0 ? 'critical' : 'warning',
      });
    }

    // Jira, plans, moved dates and the weekly digest, likewise unfiltered.
    for (const event of await this.events.all()) {
      items.push({
        key: `event:${event.dedupKey}`,
        group: event.kind.startsWith('jira')
          ? 'Jira'
          : event.kind === 'estate.weekly'
            ? 'Digest'
            : 'Plans and changes',
        title: event.title,
        subtitle: event.subtitle ?? '',
        severity: event.severity,
      });
    }

    return items;
  }

  /** Sends one of them, or all of them. Records neither. */
  async sendAvailable(keys: string[] | 'all'): Promise<{
    dryRun: boolean;
    sent: number;
    failed: number;
    titles: string[];
  }> {
    const wanted = (key: string) => keys === 'all' || keys.includes(key);

    const titles: string[] = [];
    let sent = 0;
    let failed = 0;

    const record = (label: string, ok: boolean) => {
      titles.push(label);
      ok ? (sent += 1) : (failed += 1);
    };

    for (const due of await this.deadlines.due()) {
      if (!wanted(`eol:${due.cycleId}`)) {
        continue;
      }

      const card = buildDeadlineCard(due, this.app.baseUrl);
      try {
        await this.channel.send(card);
        record(card.title, true);
      } catch (error) {
        record(card.title, false);
        this.logger.warn(`Could not post "${card.title}": ${message(error)}`);
      }
    }

    for (const event of await this.events.all()) {
      if (!wanted(`event:${event.dedupKey}`)) {
        continue;
      }

      try {
        await this.channel.sendRaw(event.title, toAdaptiveCard(event));
        record(event.title, true);
      } catch (error) {
        record(event.title, false);
        this.logger.warn(`Could not post "${event.title}": ${message(error)}`);
      }
    }

    return { dryRun: this.config.dryRun, sent, failed, titles };
  }

  /** Refreshes the end-of-life dates from endoflife.date. */
  resync(): Promise<SyncResult> {
    return this.eolSync.run();
  }

  /** Posts a card that says only that the connection works. */
  async test(actor: Actor): Promise<{ ok: boolean; detail: string }> {
    const sender = await this.senderOf(actor);

    try {
      await this.channel.sendRaw('Connection test', {
        type: 'AdaptiveCard',
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.4',
        body: [
          {
            type: 'TextBlock',
            text: '🔵 EOL Registry — connection test',
            weight: 'Bolder',
            wrap: true,
          },
          {
            type: 'TextBlock',
            text: `Sent by ${sender.name}. If you can see this, the webhook works.`,
            isSubtle: true,
            wrap: true,
          },
        ],
      });

      return {
        ok: true,
        detail: this.config.dryRun
          ? 'Rendered only — NOTIFY_DRY_RUN is true, so nothing was posted.'
          : `Posted to ${this.channel.name}.`,
      };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : 'the send failed',
      };
    }
  }

  /** The token has no display name, so the account is read for one. */
  private async senderOf(actor: Actor): Promise<Sender> {
    const user = await this.prisma.appUser.findUnique({
      where: { id: actor.id },
      select: { displayName: true, email: true },
    });

    return {
      email: user?.email ?? actor.email,
      name: user?.displayName ?? user?.email ?? actor.email,
    };
  }

  private async toEvent(
    input: CustomMessageDto,
    sender: Sender,
  ): Promise<NotificationEvent> {
    return {
      kind: 'estate.weekly', // only shapes the card; the stored kind is manual.custom
      // Unique per send. A person who sends the same message twice meant to.
      dedupKey: `manual.custom|${Date.now()}|${sender.email}`,
      subject: sender.email,
      severity: (input.severity ?? 'info') as Severity,
      title: input.title,
      subtitle: input.subtitle,
      facts: input.facts ?? [],
      lines: [
        ...(input.lines ?? []),
        '',
        `_Sent by ${sender.name} from the EOL Registry._`,
      ],
      mentions: await this.resolveMentions(input.mention),
      actions:
        input.actions?.map((action) => ({
          label: action.label,
          url: action.url,
        })) ?? [{ label: 'Open the registry', url: this.app.baseUrl }],
    };
  }

  private async resolveMentions(
    requested: string[] | undefined,
  ): Promise<EventMention[]> {
    if (!requested || requested.length === 0) {
      return [];
    }

    const everyone = requested.includes('everyone');

    const users = await this.prisma.appUser.findMany({
      where: everyone
        ? { isActive: true, role: { not: 'VIEWER' } }
        : { isActive: true, email: { in: requested.map((r) => r.toLowerCase()) } },
      orderBy: { displayName: 'asc' },
    });

    return users.map((user) => ({
      upn: user.email,
      name: user.displayName ?? user.email,
    }));
  }
}
