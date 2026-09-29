import { Inject, Injectable } from '@nestjs/common';
import { appConfig, AppConfig } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationEvent } from './notification-event';
import { everyEngineer, isoDate, longDate, plural } from './shared';

const MS_PER_DAY = 86_400_000;

/** How far back to look for changes on each pass. */
const WINDOW_DAYS = 2;

/**
 * Cycles whose support window moved, or that stopped being maintained.
 *
 * These are the warnings nothing else gives you. A threshold alert fires when
 * time passes, which you can predict; this fires when the vendor changes their
 * mind, which you cannot - and a date pulled forward by two years turns a
 * comfortable plan into an urgent one overnight.
 *
 * Reads technology_cycle_history, so it depends on whatever writes the cycles
 * recording what it changed.
 */
@Injectable()
export class EolChangeDetector {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
  ) {}

  async detect(now = new Date()): Promise<NotificationEvent[]> {
    const since = new Date(now.getTime() - WINDOW_DAYS * MS_PER_DAY);

    const changes = await this.prisma.technologyCycleHistory.findMany({
      where: {
        changedAt: { gte: since },
        field: { in: ['eolDate', 'isMaintained'] },
      },
      include: { cycle: { include: { technology: true } } },
      orderBy: { changedAt: 'desc' },
    });

    if (changes.length === 0) {
      return [];
    }

    const events: NotificationEvent[] = [];
    const mentions = await everyEngineer(this.prisma);

    for (const change of changes) {
      const where = await this.environmentsRunning(change.technologyCycleId);

      // A cycle nobody runs is not news. The catalogue holds every cycle the
      // vendor publishes, and announcing changes to versions we have never
      // deployed would bury the ones we have.
      if (where.length === 0) {
        continue;
      }

      const name = `${change.cycle.technology.name} ${change.cycle.cycle}`;

      if (change.field === 'isMaintained' && change.newValue === 'false') {
        events.push({
          kind: 'eol.unmaintained',
          dedupKey: `eol.unmaintained|${change.technologyCycleId}`,
          subject: change.technologyCycleId,
          severity: 'warning',
          title: `${name} is no longer maintained`,
          subtitle: `Marked unmaintained upstream on ${longDate(change.changedAt)} · ${where.length} ${plural(where.length, 'environment')}`,
          facts: [{ title: 'Affected', value: where.join(', ') }],
          mentions,
          actions: [{ label: 'Open in registry', url: this.app.baseUrl }],
        });
        continue;
      }

      if (change.field !== 'eolDate') {
        continue;
      }

      const before = change.oldValue ? new Date(change.oldValue) : null;
      const after = change.newValue ? new Date(change.newValue) : null;

      if (!after) {
        continue;
      }

      const sooner = before !== null && after.getTime() < before.getTime();
      const shift =
        before === null
          ? null
          : Math.abs(
              Math.round((after.getTime() - before.getTime()) / MS_PER_DAY),
            );

      events.push({
        kind: 'eol.date-moved',
        // The new date is in the key, so a second change to the same cycle is
        // a new announcement rather than a silenced one.
        dedupKey: `eol.date-moved|${change.technologyCycleId}|${isoDate(after)}`,
        subject: change.technologyCycleId,
        severity: sooner ? 'warning' : 'info',
        title: sooner
          ? `${name} now ends sooner`
          : before === null
            ? `${name} has an end-of-life date`
            : `${name} now ends later`,
        subtitle: before
          ? `${longDate(before)} → ${longDate(after)}, changed by the vendor`
          : `Ends ${longDate(after)}`,
        facts: [
          { title: 'Affected', value: where.join(', ') },
          ...(before ? [{ title: 'Was', value: longDate(before) }] : []),
          { title: 'Now', value: longDate(after) },
          ...(shift !== null
            ? [
                {
                  title: sooner ? 'Notice lost' : 'Notice gained',
                  value: `${shift} ${plural(shift, 'day')}`,
                },
              ]
            : []),
        ],
        mentions,
        actions: [{ label: 'Open in registry', url: this.app.baseUrl }],
      });
    }

    return events;
  }

  private async environmentsRunning(cycleId: string): Promise<string[]> {
    const components = await this.prisma.deploymentComponent.findMany({
      where: {
        techVersion: { technologyCycleId: cycleId },
        deployment: { archivedAt: null },
      },
      include: {
        deployment: {
          include: { project: { include: { customer: true } } },
        },
      },
    });

    return [
      ...new Set(
        components.map(
          (c) =>
            `${c.deployment.project.customer.name} ${c.deployment.environment}`,
        ),
      ),
    ];
  }
}
