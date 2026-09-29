import { Inject, Injectable } from '@nestjs/common';
import { appConfig, AppConfig, jiraConfig, JiraConfig } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationEvent, EventMention } from './notification-event';
import { everyEngineer, isoDate, longDate, plural } from './shared';

const MS_PER_DAY = 86_400_000;

/** Silence before a persistent sync failure is worth repeating. */
const FAILURE_REPEAT_DAYS = 7;

/**
 * What the linked Jira issues are doing.
 *
 * Works from the mirror the sync already keeps on each plan rather than from
 * Jira directly: the sync stores status, category and sub-task counts, and the
 * dedup key carries whichever of those the announcement is about. So a plan
 * that reaches "In Progress" is announced once, and again only if it leaves and
 * returns.
 */
@Injectable()
export class JiraDetector {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
    @Inject(jiraConfig.KEY) private readonly jira: JiraConfig,
  ) {}

  async detect(now = new Date()): Promise<NotificationEvent[]> {
    const plans = await this.prisma.upgradeAction.findMany({
      where: { jiraKey: { not: null } },
      include: {
        cycle: { include: { technology: true } },
        assignee: true,
        deployments: {
          include: {
            deployment: {
              include: { project: { include: { customer: true } } },
            },
          },
        },
      },
    });

    const events: NotificationEvent[] = [];
    const failing = plans.filter((plan) => plan.jiraSyncError);

    for (const plan of plans) {
      const key = plan.jiraKey as string;
      const name =
        `${plan.cycle.technology.name} ${plan.cycle.cycle}` +
        (plan.targetVersion ? ` → ${plan.targetVersion}` : '');

      const environments = plan.deployments.map(
        (d) =>
          `${d.deployment.project.customer.name} ${d.deployment.environment}`,
      );

      const mentions = this.mentionsFor(plan.assignee);
      const actions = this.actionsFor(key);
      const total = plan.jiraSubtaskTotal ?? plan.deployments.length;
      const done = plan.jiraSubtaskDone ?? 0;

      // Raised: announced once per issue key, so relinking a plan to a
      // different issue announces the new one.
      events.push({
        kind: 'jira.raised',
        dedupKey: `jira.raised|${plan.id}|${key}`,
        subject: plan.id,
        severity: 'info',
        title: `${key} raised — upgrade ${name}`,
        subtitle:
          `${total} ${plural(total, 'sub-task')} · ` +
          (plan.plannedDate ? `due ${longDate(plan.plannedDate)}` : 'no due date'),
        facts: [
          { title: 'Steps', value: environments.join(', ') || 'none' },
          {
            title: 'Assignee',
            value: plan.jiraAssignee ?? 'unassigned',
          },
        ],
        // An acknowledgement, not a request - nobody is being asked to act, so
        // nobody is tagged.
        mentions: [],
        actions,
      });

      if (plan.jiraStatusCategory === 'in-progress') {
        events.push({
          kind: 'jira.in-progress',
          dedupKey: `jira.in-progress|${plan.id}|${key}|${plan.jiraStatus ?? ''}`,
          subject: plan.id,
          severity: 'info',
          title: `${key} is in progress`,
          subtitle: `${name} · ${done} of ${total} steps done`,
          facts: [
            { title: 'Assignee', value: plan.jiraAssignee ?? 'unassigned' },
            {
              title: 'Remaining',
              value:
                plan.deployments
                  .filter((d) => !d.completedAt)
                  .map(
                    (d) =>
                      `${d.deployment.project.customer.name} ${d.deployment.environment}`,
                  )
                  .join(', ') || 'none',
            },
          ],
          mentions,
          actions,
        });
      }

      if (plan.jiraStatusCategory === 'done') {
        events.push({
          kind: 'jira.done',
          dedupKey: `jira.done|${plan.id}|${key}`,
          subject: plan.id,
          severity: 'good',
          title: `${key} complete — ${name}`,
          subtitle: `${environments.length} ${plural(environments.length, 'environment')} done`,
          facts: [
            { title: 'Completed', value: environments.join(', ') || 'none' },
            {
              title: 'Took',
              value: plan.createdAt
                ? `${Math.max(1, Math.round((now.getTime() - plan.createdAt.getTime()) / MS_PER_DAY))} days`
                : 'unknown',
            },
          ],
          mentions,
          actions,
        });
      }
    }

    if (failing.length > 0) {
      const first = failing[0];
      const mentions = await everyEngineer(this.prisma);

      events.push({
        kind: 'jira.sync-failing',
        // Whole weeks, so a long outage is announced weekly, not daily.
        dedupKey: `jira.sync-failing|${isoDate(now).slice(0, 7)}|${Math.floor(now.getTime() / (FAILURE_REPEAT_DAYS * MS_PER_DAY))}`,
        subject: 'jira',
        severity: 'warning',
        title: `Jira sync failing for ${failing.length} ${plural(failing.length, 'plan')}`,
        subtitle: first.jiraSyncError ?? 'unknown error',
        facts: [
          {
            title: 'Affected plans',
            value: failing.map((plan) => plan.jiraKey).join(', '),
          },
          {
            title: 'Last succeeded',
            value: first.jiraSyncedAt ? longDate(first.jiraSyncedAt) : 'never',
          },
        ],
        mentions,
        actions: [{ label: 'Open in registry', url: `${this.app.baseUrl}/plan` }],
      });
    }

    return events;
  }

  private mentionsFor(
    assignee: { email: string; displayName: string | null } | null,
  ): EventMention[] {
    if (!assignee) {
      return [];
    }

    return [
      { upn: assignee.email, name: assignee.displayName ?? assignee.email },
    ];
  }

  private actionsFor(key: string): { label: string; url: string }[] {
    const actions = [
      { label: 'Open in registry', url: `${this.app.baseUrl}/plan` },
    ];

    if (this.jira.baseUrl) {
      actions.unshift({
        label: `Open ${key}`,
        url: `${this.jira.baseUrl}/browse/${key}`,
      });
    }

    return actions;
  }
}
