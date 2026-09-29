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

const DIGEST_ABOVE = 5;

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

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
    @Inject(notificationConfig.KEY) private readonly config: NotificationConfig,
  ) {}

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
        audience: [],
      });
    }

    const dues = [...byCycle.values()];
    await this.attachMentions(dues);

    return dues.sort((a, b) => a.days - b.days);
  }

  private async attachMentions(dues: Due[]): Promise<void> {
    // End-of-life is estate-wide and nobody owns it individually, so every
    // active editor is tagged rather than one project lead. The lead is still
    // resolved below, but only to fill in the "Plan" fact.
    const team = await this.prisma.appUser.findMany({
      where: { isActive: true, role: { not: 'VIEWER' } },
      orderBy: { displayName: 'asc' },
    });

    const audience = team.map((user) => ({
      upn: user.email,
      name: user.displayName ?? user.email,
    }));

    for (const due of dues) {
      due.audience = audience;
    }

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
        upn: lead.user.email,
        name,
        why: 'project lead — nobody is assigned',
      };
    }
  }

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

    if (this.config.dryRun) {
      return;
    }

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

  status() {
    return {
      enabled: this.config.enabled,
      dryRun: this.config.dryRun,
      configured: Boolean(this.config.teamsWebhookUrl),
      channel: this.channel.name,
      cron: this.config.cron,
    };
  }
}

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
