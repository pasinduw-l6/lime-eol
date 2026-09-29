import { Inject, Injectable } from '@nestjs/common';
import { appConfig, AppConfig } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationEvent, EventFact } from './notification-event';
import { everyEngineer, isoWeek, longDate, plural } from './shared';

const MS_PER_DAY = 86_400_000;
const NEAR_DAYS = 90;
const MAX_ROWS = 10;

interface CycleRow {
  cycleId: string;
  technology: string;
  cycle: string;
  eolDate: Date | null;
  environments: string[];
  customers: Set<string>;
}

/**
 * The Monday summary.
 *
 * This is the one message that goes out whether or not anything happened, which
 * is what stops silence being ambiguous: no digest means the job is broken, not
 * that the estate is healthy.
 */
@Injectable()
export class EstateDetector {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
  ) {}

  async detect(now = new Date()): Promise<NotificationEvent[]> {
    const components = await this.prisma.deploymentComponent.findMany({
      where: { deployment: { archivedAt: null } },
      include: {
        deployment: {
          include: { project: { include: { customer: true } } },
        },
        techVersion: {
          include: { cycle: { include: { technology: true } } },
        },
      },
    });

    if (components.length === 0) {
      return [];
    }

    const rows = groupByCycle(components);
    const past = rows
      .filter((row) => isPast(row.eolDate, now))
      .sort((a, b) => daysUntil(a.eolDate, now) - daysUntil(b.eolDate, now));
    const near = rows
      .filter((row) => isNear(row.eolDate, now))
      .sort((a, b) => daysUntil(a.eolDate, now) - daysUntil(b.eolDate, now));
    const safe = rows.filter(
      (row) => !isPast(row.eolDate, now) && !isNear(row.eolDate, now),
    );

    const plans = await this.prisma.upgradeAction.findMany({
      where: { completedDate: null },
      include: {
        cycle: { include: { technology: true } },
        deployments: true,
      },
      orderBy: { plannedDate: 'asc' },
    });

    const overdue = plans.filter(
      (plan) => plan.plannedDate !== null && plan.plannedDate < now,
    );

    const planned = new Set(plans.map((plan) => plan.technologyCycleId));
    const unplanned = past.filter((row) => !planned.has(row.cycleId));

    const facts: EventFact[] = [
      {
        title: 'Past end of life',
        value: `${past.length} ${plural(past.length, 'cycle')}`,
      },
      { title: `Ending within ${NEAR_DAYS} days`, value: String(near.length) },
      { title: 'Supported', value: String(safe.length) },
      {
        title: 'Plans in flight',
        value:
          plans.length === 0
            ? 'none'
            : `${plans.length}${overdue.length > 0 ? ` — ${overdue.length} overdue` : ''}`,
      },
      { title: 'No plan yet', value: String(unplanned.length) },
    ];

    const lines: string[] = [];

    if (past.length > 0) {
      lines.push('**Past end of life**');
      lines.push(...table(past, now).slice(0, MAX_ROWS));
      if (past.length > MAX_ROWS) {
        lines.push(`_+ ${past.length - MAX_ROWS} more — open the registry_`);
      }
    }

    if (near.length > 0) {
      lines.push('', `**Ending within ${NEAR_DAYS} days**`);
      lines.push(...table(near, now).slice(0, MAX_ROWS));
    }

    if (plans.length > 0) {
      lines.push('', '**Plans in flight**');
      for (const plan of plans.slice(0, MAX_ROWS)) {
        const late =
          plan.plannedDate && plan.plannedDate < now
            ? ` — ${Math.round((now.getTime() - plan.plannedDate.getTime()) / MS_PER_DAY)} days overdue`
            : plan.plannedDate
              ? ` — due ${longDate(plan.plannedDate)}`
              : '';
        const done = plan.deployments.filter((d) => d.completedAt).length;

        lines.push(
          `- ${plan.jiraKey ? `${plan.jiraKey}: ` : ''}` +
            `${plan.cycle.technology.name} ${plan.cycle.cycle}` +
            `${plan.targetVersion ? ` → ${plan.targetVersion}` : ''}` +
            ` (${done}/${plan.deployments.length})${late}`,
        );
      }
    }

    if (unplanned.length > 0) {
      lines.push(
        '',
        `**No plan yet:** ` +
          unplanned
            .slice(0, MAX_ROWS)
            .map((row) => `${row.technology} ${row.cycle}`)
            .join(', '),
      );
    }

    const customers = new Set(
      components.map((c) => c.deployment.project.customer.name),
    );
    const environments = new Set(components.map((c) => c.deploymentId));

    return [
      {
        kind: 'estate.weekly',
        // The week number, so Monday's digest is sent once however often the
        // job runs, and next Monday's is a different announcement.
        dedupKey: `estate.weekly|${isoWeek(now)}`,
        subject: 'estate',
        severity: past.length > 0 ? 'critical' : 'good',
        title: `Estate summary — week of ${longDate(now)}`,
        subtitle:
          `${customers.size} ${plural(customers.size, 'customer')} · ` +
          `${environments.size} ${plural(environments.size, 'environment')} · ` +
          `${components.length} components · ${past.length + near.length} at risk`,
        facts,
        lines,
        mentions: await everyEngineer(this.prisma),
        actions: [
          { label: 'Open the registry', url: this.app.baseUrl },
          { label: 'Open the plan board', url: `${this.app.baseUrl}/plan` },
        ],
      },
    ];
  }
}

function groupByCycle(
  components: {
    deploymentId: string;
    deployment: { environment: string; project: { customer: { name: string } } };
    techVersion: {
      cycle: {
        id: string;
        cycle: string;
        eolDate: Date | null;
        technology: { name: string };
      };
    };
  }[],
): CycleRow[] {
  const byCycle = new Map<string, CycleRow>();

  for (const component of components) {
    const cycle = component.techVersion.cycle;
    const where = `${component.deployment.project.customer.name} ${component.deployment.environment}`;

    const row = byCycle.get(cycle.id) ?? {
      cycleId: cycle.id,
      technology: cycle.technology.name,
      cycle: cycle.cycle,
      eolDate: cycle.eolDate,
      environments: [],
      customers: new Set<string>(),
    };

    if (!row.environments.includes(where)) {
      row.environments.push(where);
    }
    row.customers.add(component.deployment.project.customer.name);
    byCycle.set(cycle.id, row);
  }

  return [...byCycle.values()];
}

function table(rows: CycleRow[], now: Date): string[] {
  return rows.map((row) => {
    const days = daysUntil(row.eolDate, now);
    const when =
      days < 0
        ? `${gap(-days)} past`
        : `${days} ${plural(days, 'day')} — ${longDate(row.eolDate as Date)}`;

    return `- ${row.technology} ${row.cycle} · ${when} · ${row.environments.join(', ')}`;
  });
}

function gap(days: number): string {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months > 0
      ? `${years}y ${months}m`
      : `${years} ${plural(years, 'year')}`;
  }
  if (days >= 30) {
    const months = Math.floor(days / 30);
    return `${months} ${plural(months, 'month')}`;
  }
  return `${days} ${plural(days, 'day')}`;
}

function daysUntil(date: Date | null, now: Date): number {
  if (!date) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Math.round((date.getTime() - now.getTime()) / MS_PER_DAY);
}

function isPast(date: Date | null, now: Date): boolean {
  return date !== null && date.getTime() < now.getTime();
}

function isNear(date: Date | null, now: Date): boolean {
  if (!date || isPast(date, now)) {
    return false;
  }
  return daysUntil(date, now) <= NEAR_DAYS;
}
