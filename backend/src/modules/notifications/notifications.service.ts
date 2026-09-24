import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { notificationConfig, NotificationConfig } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NOTIFICATION_CHANNEL,
  NotificationCard,
  NotificationChannel,
} from './ports/notification-channel.port';
import { buildDigest, buildDeadlineCard, Due } from './notifications.renderer';

const MS_PER_DAY = 86_400_000;

/** Above this, one summary goes out instead of a card each. */
const DIGEST_ABOVE = 5;

/** How often something already unsupported is repeated. */
const PAST_EOL_REPEAT_DAYS = 7;

export interface RunResult {
  dryRun: boolean;
  found: number;
  skipped: number;
  sent: number;
  failed: number;
  asDigest: boolean;
  cards: NotificationCard[];
}

/**
 * Deciding what to announce, and remembering that it was announced.
 *
 * The dedup key is enforced by a unique index rather than by this code, so two
 * runs overlapping cannot double-post. It includes the end-of-life date, which
 * is what makes a moved deadline re-arm every threshold instead of being
 * silently suppressed.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
    @Inject(notificationConfig.KEY) private readonly config: NotificationConfig,
  ) {}

  /**
   * Everything inside a notice period that has not been announced yet.
   *
   * Read straight from the estate: cycles that something is actually running,
   * with the environments running them and whoever is answerable.
   */
  async due(): Promise<Due[]> {
    const rules = await this.prisma.notificationRule.findMany({
      where: { isActive: true, teamsEnabled: true },
      orderBy: { thresholdDays: 'desc' },
    });

    if (rules.length === 0) {
      return [];
    }

    const components = await this.prisma.deploymentComponent.findMany({
      where: { deployment: { archivedAt: null } },
      include: {
        deployment: { include: { project: true } },
        techVersion: {
          include: { cycle: { include: { technology: true } } },
        },
      },
    });

    // One entry per cycle, carrying every environment that runs it — a card
    // per environment would say the same thing three times.
    const byCycle = new Map<string, Due>();

    for (const component of components) {
      const cycle = component.techVersion.cycle;
      const project = component.deployment.project;

      if (!cycle.eolDate || !project) {
        continue;
      }

      const days = daysUntil(cycle.eolDate);
      const threshold = thresholdFor(days, rules.map((r) => r.thresholdDays));
      if (threshold === null) {
        continue;
      }

      const existing = byCycle.get(cycle.id);
      if (existing) {
        existing.environments.push(component.deployment.environment);
        existing.versions.add(component.techVersion.fullVersion);
        continue;
      }

      byCycle.set(cycle.id, {
        cycleId: cycle.id,
        technology: cycle.technology.name,
        cycle: cycle.cycle,
        eolDate: cycle.eolDate,
        latestPatch: cycle.latestPatch,
        days,
        threshold,
        projectName: project.name,
        projectCode: project.code,
        projectId: project.id,
        environments: [component.deployment.environment],
        versions: new Set([component.techVersion.fullVersion]),
        mention: null,
      });
    }

    const dues = [...byCycle.values()];
    await this.attachMentions(dues);

    return dues.sort((a, b) => a.days - b.days);
  }

  /**
   * Whoever should answer for each one.
   *
   * There is no upgrade-action API yet, so nothing is ever "assigned" — every
   * card falls to the project lead. When actions are persisted this is where
   * the assignee takes over.
   */
  private async attachMentions(dues: Due[]): Promise<void> {
    const projectIds = [...new Set(dues.map((d) => d.projectId))];

    const staffing = await this.prisma.projectEngineer.findMany({
      where: { projectId: { in: projectIds }, user: { isActive: true } },
      include: { user: true },
      orderBy: { isLead: 'desc' },
    });

    for (const due of dues) {
      const lead = staffing.find((s) => s.projectId === due.projectId);
      if (!lead?.user) {
        continue;
      }

      const name = lead.user.displayName ?? lead.user.email;
      due.mention = {
        // The sign-in address; a display name alone cannot be mentioned.
        upn: lead.user.email,
        name,
        why: 'project lead — nobody is assigned',
      };
    }
  }

  /** What has already gone out, so the same thing is not announced twice. */
  private async alreadySent(dues: Due[]): Promise<Set<string>> {
    const sent = await this.prisma.notificationLog.findMany({
      where: {
        technologyCycleId: { in: dues.map((d) => d.cycleId) },
        channel: Channel.TEAMS,
        success: true,
      },
      select: {
        technologyCycleId: true,
        referenceDate: true,
        thresholdDays: true,
        sentAt: true,
      },
    });

    const suppressed = new Set<string>();

    for (const row of sent) {
      const key = `${row.technologyCycleId}|${iso(row.referenceDate)}|${row.thresholdDays}`;

      // Something already unsupported is repeated weekly; every other
      // threshold is announced once and then stays quiet.
      if (row.thresholdDays === 0) {
        const age = (Date.now() - row.sentAt.getTime()) / MS_PER_DAY;
        if (age < PAST_EOL_REPEAT_DAYS) {
          suppressed.add(key);
        }
        continue;
      }

      suppressed.add(key);
    }

    return suppressed;
  }

  /**
   * The whole run: find, filter, render, send, record.
   *
   * Safe to call by hand — with NOTIFY_DRY_RUN on it renders and logs without
   * a single request leaving the machine.
   */
  async run(): Promise<RunResult> {
    const dues = await this.due();
    const suppressed = await this.alreadySent(dues);

    const fresh = dues.filter(
      (d) => !suppressed.has(`${d.cycleId}|${iso(d.eolDate)}|${d.threshold}`),
    );

    const result: RunResult = {
      dryRun: this.config.dryRun,
      found: dues.length,
      skipped: dues.length - fresh.length,
      sent: 0,
      failed: 0,
      asDigest: false,
      cards: [],
    };

    if (fresh.length === 0) {
      return result;
    }

    const appUrl = this.config.appBaseUrl;

    // One summary rather than a wall of cards. Six at once into the only
    // channel the team has is how a channel gets muted on its first day.
    if (fresh.length > DIGEST_ABOVE) {
      result.asDigest = true;
      const digest = buildDigest(fresh, appUrl);
      result.cards.push(digest);
      await this.deliver(digest, fresh, result);
      return result;
    }

    for (const due of fresh) {
      const card = buildDeadlineCard(due, appUrl);
      result.cards.push(card);
      await this.deliver(card, [due], result);
    }

    return result;
  }

  /** Sends one card and records the outcome against everything it covered. */
  private async deliver(
    card: NotificationCard,
    covers: Due[],
    result: RunResult,
  ): Promise<void> {
    let error: string | null = null;

    try {
      await this.channel.send(card);
      result.sent++;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'the send failed';
      result.failed++;
      this.logger.warn(`Could not post "${card.title}": ${error}`);
    }

    // A dry run must not claim anything was announced. Recording it would mark
    // every deadline as sent, and the first real run would then find nothing
    // to say — the rehearsal would have consumed the performance.
    if (this.config.dryRun) {
      return;
    }

    // Otherwise recorded either way. A failure that leaves no trace is
    // indistinguishable from a quiet week, which is the worst thing this tool
    // could do.
    for (const due of covers) {
      await this.prisma.notificationLog.upsert({
        where: {
          technologyCycleId_referenceDate_thresholdDays_recipient_channel: {
            technologyCycleId: due.cycleId,
            referenceDate: due.eolDate,
            thresholdDays: due.threshold,
            recipient: this.channel.name,
            channel: Channel.TEAMS,
          },
        },
        update: { success: error === null, error, sentAt: new Date() },
        create: {
          technologyCycleId: due.cycleId,
          referenceDate: due.eolDate,
          thresholdDays: due.threshold,
          recipient: this.channel.name,
          channel: Channel.TEAMS,
          success: error === null,
          error,
        },
      });
    }
  }

  /** The log, newest first, for the bell. */
  async log(limit = 50) {
    const rows = await this.prisma.notificationLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: Math.min(limit, 200),
      include: { cycle: { include: { technology: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      at: row.sentAt.toISOString(),
      technology: row.cycle.technology.name,
      cycle: row.cycle.cycle,
      threshold: row.thresholdDays,
      recipient: row.recipient,
      channel: row.channel,
      success: row.success,
      error: row.error,
    }));
  }

  /** Whether anything could actually be delivered right now. */
  status() {
    return {
      enabled: this.config.enabled,
      dryRun: this.config.dryRun,
      // Never the URL itself: it carries the signature.
      configured: Boolean(this.config.teamsWebhookUrl),
      channel: this.channel.name,
      cron: this.config.cron,
    };
  }
}

/** The tightest notice period a cycle has fallen inside. */
function thresholdFor(days: number, thresholds: number[]): number | null {
  const matching = thresholds
    .filter((t) => days <= t)
    .sort((a, b) => a - b);

  return matching.length > 0 ? matching[0] : null;
}

function daysUntil(date: Date): number {
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((date.getTime() - todayUtc) / MS_PER_DAY);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
