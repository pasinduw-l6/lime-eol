import { Inject, Injectable } from '@nestjs/common';
import { appConfig, AppConfig, jiraConfig, JiraConfig } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationEvent, EventMention } from './notification-event';
import { everyEngineer, isoDate, longDate, plural } from './shared';

const MS_PER_DAY = 86_400_000;

const REPEAT_DAYS = 7;

@Injectable()
export class PlanDetector {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
    @Inject(jiraConfig.KEY) private readonly jira: JiraConfig,
  ) {}

  async detect(now = new Date()): Promise<NotificationEvent[]> {
    const plans = await this.prisma.upgradeAction.findMany({
      where: {
        completedDate: null,
        plannedDate: { lt: now },
        status: { not: 'COMPLETED' },
      },
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

    for (const plan of plans) {
      if (!plan.plannedDate) {
        continue;
      }

      const late = Math.floor(
        (now.getTime() - plan.plannedDate.getTime()) / MS_PER_DAY,
      );
      const outstanding = plan.deployments.filter((d) => !d.completedAt);
      const done = plan.deployments.length - outstanding.length;

      const mentions: EventMention[] = plan.assignee
        ? [
            {
              upn: plan.assignee.email,
              name: plan.assignee.displayName ?? plan.assignee.email,
            },
          ]
        : await everyEngineer(this.prisma);

      const actions = [
        { label: 'Open in registry', url: `${this.app.baseUrl}/plan` },
      ];

      if (plan.jiraKey && this.jira.baseUrl) {
        actions.unshift({
          label: `Open ${plan.jiraKey}`,
          url: `${this.jira.baseUrl}/browse/${plan.jiraKey}`,
        });
      }

      events.push({
        kind: 'plan.overdue',
        dedupKey: `plan.overdue|${plan.id}|${isoDate(plan.plannedDate)}|${Math.floor(late / REPEAT_DAYS)}`,
        subject: plan.id,
        severity: 'critical',
        title:
          `${plan.jiraKey ? `${plan.jiraKey} is` : 'A plan is'} ` +
          `${late} ${plural(late, 'day')} past its planned date`,
        subtitle:
          `${plan.cycle.technology.name} ${plan.cycle.cycle}` +
          `${plan.targetVersion ? ` → ${plan.targetVersion}` : ''} · ` +
          `planned ${longDate(plan.plannedDate)} · ` +
          `${done} of ${plan.deployments.length} steps done`,
        facts: [
          {
            title: 'Assignee',
            value: plan.assignee
              ? (plan.assignee.displayName ?? plan.assignee.email)
              : 'unassigned',
          },
          {
            title: 'Outstanding',
            value:
              outstanding
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

    return events;
  }
}
