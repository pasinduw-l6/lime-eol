import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { jiraConfig, JiraConfig } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDuration } from './duration';
import { IntegrationsService } from '../integrations/integrations.service';
import { JiraAdapter } from './adapters/jira.adapter';
import {
  ISSUE_TRACKER,
  IssueChange,
  IssueTracker,
  TrackedIssue,
  Transition,
  Worklog,
} from './ports/issue-tracker.port';

const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;

@Injectable()
export class IssueTrackerService {
  private readonly logger = new Logger(IssueTrackerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ISSUE_TRACKER) private readonly tracker: IssueTracker,
    @Inject(jiraConfig.KEY) private readonly config: JiraConfig,
    private readonly integrations: IntegrationsService,
  ) {}

  async status() {
    const configured = this.tracker.configured;
    const check = configured
      ? await this.tracker.check()
      : { ok: false, detail: 'No Jira credentials are configured.' };

    return {
      tracker: this.tracker.name,
      configured,
      reachable: check.ok,
      detail: check.detail,
      demo: this.config.demo,
      missing: this.config.missing,
      projectKey: this.config.projectKey ?? null,
      baseUrl: this.config.baseUrl ?? null,
      cron: this.config.cron,
    };
  }

  async link(actionId: string, issueKey: string, integrationId?: string | null) {
    const key = issueKey.trim().toUpperCase();

    if (!ISSUE_KEY.test(key)) {
      throw new BadRequestException(
        'That does not look like a Jira key. Expected something like OPS-1042.',
      );
    }

    await this.mustExist(actionId);

    const connection =
      integrationId === undefined
        ? (await this.projectConnection(actionId)).integrationId
        : integrationId;

    let issue: TrackedIssue;
    try {
      const tracker = await this.trackerFor(connection);
      issue = await tracker.getIssue(key);
    } catch (error) {
      throw new BadRequestException(
        `Could not read ${key} from Jira: ${message(error)}`,
      );
    }

    await this.prisma.upgradeAction.update({
      where: { id: actionId },
      data: {
        jiraIntegrationId: connection,
        jiraKey: issue.key,
        jiraIssueId: issue.id,
        jiraUrl: issue.url,
        jiraSyncError: null,
      },
    });

    return this.sync(actionId);
  }

  async createFor(actionId: string, withSteps = true) {
    const action = await this.prisma.upgradeAction.findUnique({
      where: { id: actionId },
      include: {
        cycle: { include: { technology: true } },
        deployments: {
          include: {
            deployment: {
              include: { project: { include: { customer: true } } },
            },
          },
        },
      },
    });

    if (!action) {
      throw new NotFoundException('No such plan.');
    }

    if (action.jiraKey) {
      throw new BadRequestException(
        `That plan is already linked to ${action.jiraKey}.`,
      );
    }

    const connection = await this.projectConnection(actionId);
    const tracker = await this.trackerFor(connection.integrationId, connection.projectKey);

    if (!tracker.configured) {
      throw new BadRequestException(
        'No issue tracker is configured, so there is nowhere to create it.',
      );
    }

    const technology = action.cycle.technology.name;
    const cycle = action.cycle.cycle;
    const eol = action.cycle.eolDate;

    const environments = action.deployments.map(
      (link) =>
        `${link.deployment.project.customer.name} ${link.deployment.environment}`,
    );

    const summary = `Upgrade ${technology} ${cycle}` +
      (action.targetVersion ? ` to ${action.targetVersion}` : '');

    const description = [
      `${technology} ${cycle} is running in ${environments.length} environment(s).`,
      eol
        ? `Support ended ${eol.toISOString().slice(0, 10)}.`
        : 'No end-of-life date is recorded for this cycle.',
      action.targetVersion ? `Target version: ${action.targetVersion}.` : '',
      action.plannedDate
        ? `Planned for ${action.plannedDate.toISOString().slice(0, 10)}.`
        : '',
      '',
      'Affected:',
      ...environments.map((name) => `- ${name}`),
      '',
      'Raised from the Lime Technology Lifecycle & EOL Registry.',
    ]
      .filter((line) => line !== '')
      .join('\n');

    let issue: TrackedIssue;
    try {
      issue = await tracker.createIssue({
        summary,
        description,
        dueDate: action.plannedDate?.toISOString().slice(0, 10) ?? null,
        assigneeId: null,
      });
    } catch (error) {
      await this.prisma.upgradeAction.update({
        where: { id: actionId },
        data: { jiraSyncError: `Could not create the issue: ${message(error)}` },
      });
      throw new BadRequestException(`Jira refused that: ${message(error)}`);
    }

    await this.prisma.upgradeAction.update({
      where: { id: actionId },
      data: {
        jiraIntegrationId: connection.integrationId,
        jiraKey: issue.key,
        jiraIssueId: issue.id,
        jiraUrl: issue.url,
        jiraSyncError: null,
      },
    });

    for (const environment of withSteps ? environments : []) {
      try {
        await tracker.createSubtask(issue.key, {
          summary: `${environment} — upgrade ${technology} ${cycle}`,
          description: null,
          dueDate: null,
          assigneeId: null,
        });
      } catch (error) {
        this.logger.warn(
          `Created ${issue.key} but not its step for ${environment}: ${message(error)}`,
        );
      }
    }

    return this.sync(actionId);
  }

  async unlink(actionId: string) {
    await this.mustExist(actionId);

    await this.prisma.$transaction([
      this.prisma.jiraSubtask.deleteMany({ where: { upgradeActionId: actionId } }),
      this.prisma.jiraWorklog.deleteMany({ where: { upgradeActionId: actionId } }),
      this.prisma.upgradeAction.update({
        where: { id: actionId },
        data: {
          jiraKey: null,
          jiraIssueId: null,
          jiraUrl: null,
          jiraStatus: null,
          jiraStatusCategory: null,
          jiraAssignee: null,
          jiraSubtaskDone: null,
          jiraSubtaskTotal: null,
          jiraSyncedAt: null,
          jiraSyncError: null,
        },
      }),
    ]);

    return this.read(actionId);
  }

  async sync(actionId: string) {
    const action = await this.mustExist(actionId);

    if (!action.jiraKey) {
      throw new BadRequestException('That plan is not linked to an issue.');
    }

    try {
      const tracker = await this.trackerFor(action.jiraIntegrationId);
      const [issue, children] = await Promise.all([
        tracker.getIssue(action.jiraKey),
        tracker.getChildren(action.jiraKey),
      ]);

      const done = children.filter((c) => c.statusCategory === 'done').length;

      await this.prisma.$transaction([
        this.prisma.jiraSubtask.deleteMany({
          where: { upgradeActionId: actionId },
        }),
        this.prisma.jiraSubtask.createMany({
          data: children.map((child, index) => ({
            upgradeActionId: actionId,
            issueKey: child.key,
            issueId: child.id,
            summary: child.summary,
            status: child.status,
            statusCategory: child.statusCategory,
            assignee: child.assignee,
            url: child.url,
            startDate: child.startDate ? new Date(`${child.startDate}T00:00:00.000Z`) : null,
            dueDate: child.dueDate ? new Date(`${child.dueDate}T00:00:00.000Z`) : null,
            estimateSeconds: child.estimateSeconds ?? null,
            spentSeconds: child.spentSeconds ?? null,
            remainingSeconds: child.remainingSeconds ?? null,
            position: index,
          })),
        }),
        this.prisma.upgradeAction.update({
          where: { id: actionId },
          data: {
            jiraKey: issue.key,
            jiraIssueId: issue.id,
            jiraUrl: issue.url,
            jiraStatus: issue.status,
            jiraStatusCategory: issue.statusCategory,
            jiraAssignee: issue.assignee,
            jiraSubtaskDone: done,
            jiraSubtaskTotal: children.length,
            jiraSyncedAt: new Date(),
            jiraSyncError: null,
          },
        }),
      ]);

      await this.syncWorklogs(actionId, tracker, children);
    } catch (error) {
      await this.prisma.upgradeAction.update({
        where: { id: actionId },
        data: { jiraSyncError: message(error) },
      });
      this.logger.warn(`Jira sync failed for ${action.jiraKey}: ${message(error)}`);
    }

    return this.read(actionId);
  }

  async syncAll(): Promise<{ linked: number; failed: number }> {
    const actions = await this.prisma.upgradeAction.findMany({
      where: {
        jiraKey: { not: null },
        ...(this.tracker.configured ? {} : { jiraIntegrationId: { not: null } }),
      },
      select: { id: true },
    });

    let failed = 0;
    for (const action of actions) {
      const result = await this.sync(action.id);
      if (result.syncError) {
        failed++;
      }
    }

    return { linked: actions.length, failed };
  }

  async addSubtask(
    actionId: string,
    input: {
      summary: string;
      description?: string;
      startDate?: string;
      dueDate?: string;
      assigneeId?: string;
      estimate?: string;
    },
  ) {
    let action = await this.mustExist(actionId);

    if (!action.jiraKey) {
      await this.createFor(actionId, false);
      action = await this.mustExist(actionId);
      if (!action.jiraKey) {
        throw new BadRequestException('Could not create the Jira issue for this plan.');
      }
    }

    const estimateSeconds = input.estimate ? parseDuration(input.estimate) : null;
    if (input.estimate && !estimateSeconds) {
      throw new BadRequestException('Enter the estimate like 4h, 1d or 2h 30m.');
    }

    let created;
    try {
      const tracker = await this.trackerFor(action.jiraIntegrationId);
      created = await tracker.createSubtask(action.jiraKey, {
        summary: input.summary.trim(),
        description: input.description?.trim() || null,
        startDate: input.startDate || null,
        dueDate: input.dueDate || null,
        assigneeId: input.assigneeId || null,
        estimateSeconds,
      });
    } catch (error) {
      throw new BadRequestException(`Jira refused that: ${message(error)}`);
    }

    const mirror = await this.sync(actionId);

    if (mirror.subtasks.some((task) => task.key === created.key)) {
      await this.storeFresh(actionId, created);
      return this.read(actionId);
    }

    const last = await this.prisma.jiraSubtask.findFirst({
      where: { upgradeActionId: actionId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    await this.prisma.jiraSubtask.create({
      data: {
        upgradeActionId: actionId,
        issueKey: created.key,
        issueId: created.id,
        summary: created.summary,
        status: created.status,
        statusCategory: created.statusCategory,
        assignee: created.assignee,
        url: created.url,
        ...subtaskFields(created),
        position: (last?.position ?? -1) + 1,
      },
    });

    await this.prisma.upgradeAction.update({
      where: { id: actionId },
      data: { jiraSubtaskTotal: mirror.total + 1 },
    });

    return this.read(actionId);
  }

  private async storeFresh(actionId: string, issue: TrackedIssue): Promise<void> {
    await this.prisma.jiraSubtask.updateMany({
      where: { upgradeActionId: actionId, issueKey: issue.key },
      data: {
        summary: issue.summary,
        status: issue.status,
        statusCategory: issue.statusCategory,
        assignee: issue.assignee,
        ...subtaskFields(issue),
      },
    });
  }

  private async afterChange(actionId: string, tracker: IssueTracker, key: string) {
    await this.sync(actionId);
    try {
      const fresh = await tracker.getIssue(key);
      await this.storeFresh(actionId, fresh);
      await this.syncWorklogs(actionId, tracker, [fresh], false);
    } catch (error) {
      this.logger.warn(`Could not re-read ${key} after the change: ${message(error)}`);
    }
    return this.read(actionId);
  }

  async assignees(actionId: string) {
    const action = await this.mustExist(actionId);

    if (!action.jiraKey) {
      return [];
    }

    try {
      const tracker = await this.trackerFor(action.jiraIntegrationId);
      return await tracker.getAssignees(action.jiraKey);
    } catch (error) {
      this.logger.warn(`Could not list assignees: ${message(error)}`);
      return [];
    }
  }

  async read(actionId: string) {
    const action = await this.prisma.upgradeAction.findUnique({
      where: { id: actionId },
      include: { jiraSubtasks: { orderBy: { position: 'asc' } } },
    });

    if (!action) {
      throw new NotFoundException('No such plan.');
    }

    return {
      linked: Boolean(action.jiraKey),
      key: action.jiraKey,
      url: action.jiraUrl,
      status: action.jiraStatus,
      statusCategory: action.jiraStatusCategory,
      assignee: action.jiraAssignee,
      done: action.jiraSubtaskDone ?? 0,
      total: action.jiraSubtaskTotal ?? 0,
      syncedAt: action.jiraSyncedAt?.toISOString() ?? null,
      syncError: action.jiraSyncError,
      subtasks: action.jiraSubtasks.map(toSubtask),
    };
  }

  async updateSubtask(actionId: string, key: string, change: IssueChange) {
    const { tracker } = await this.subtaskContext(actionId, key);
    try {
      await tracker.updateIssue(key, change);
    } catch (error) {
      throw new BadRequestException(`Jira refused that: ${message(error)}`);
    }
    return this.afterChange(actionId, tracker, key);
  }

  async transitions(actionId: string, key: string): Promise<Transition[]> {
    const { tracker } = await this.subtaskContext(actionId, key);
    try {
      return await tracker.getTransitions(key);
    } catch (error) {
      throw new BadRequestException(`Could not read the statuses from Jira: ${message(error)}`);
    }
  }

  async transition(actionId: string, key: string, transitionId: string) {
    const { tracker } = await this.subtaskContext(actionId, key);
    try {
      await tracker.transition(key, transitionId);
    } catch (error) {
      throw new BadRequestException(`Jira refused that: ${message(error)}`);
    }
    return this.afterChange(actionId, tracker, key);
  }

  async worklogs(actionId: string, key: string): Promise<Worklog[]> {
    const { tracker } = await this.subtaskContext(actionId, key);
    try {
      return await tracker.getWorklogs(key);
    } catch (error) {
      throw new BadRequestException(`Could not read the time log from Jira: ${message(error)}`);
    }
  }

  async logWork(actionId: string, key: string, input: { time: string; date: string; comment?: string }) {
    const seconds = parseDuration(input.time);
    if (!seconds) {
      throw new BadRequestException('Enter the time like 2h, 30m or 1h 30m.');
    }
    const { tracker } = await this.subtaskContext(actionId, key);
    try {
      await tracker.addWorklog(key, { seconds, date: input.date, comment: input.comment?.trim() || null });
    } catch (error) {
      throw new BadRequestException(`Jira refused that: ${message(error)}`);
    }
    return this.afterChange(actionId, tracker, key);
  }

  private async syncWorklogs(
    actionId: string,
    tracker: IssueTracker,
    children: TrackedIssue[],
    prune = true,
  ) {
    const stored = await this.prisma.jiraWorklog.groupBy({
      by: ['issueKey'],
      where: { upgradeActionId: actionId },
      _sum: { seconds: true },
    });
    const storedSeconds = new Map(stored.map((row) => [row.issueKey, row._sum.seconds ?? 0]));
    const keys = new Set(children.map((c) => c.key));

    if (prune) {
      await this.prisma.jiraWorklog.deleteMany({
        where: { upgradeActionId: actionId, issueKey: { notIn: [...keys] } },
      });
    }

    for (const child of children) {
      const spent = child.spentSeconds ?? 0;
      if (spent === (storedSeconds.get(child.key) ?? 0)) continue;

      try {
        const logs = spent > 0 ? await tracker.getWorklogs(child.key) : [];
        await this.prisma.$transaction([
          this.prisma.jiraWorklog.deleteMany({ where: { upgradeActionId: actionId, issueKey: child.key } }),
          this.prisma.jiraWorklog.createMany({
            data: logs.map((log) => ({
              upgradeActionId: actionId,
              issueKey: child.key,
              worklogId: log.id,
              author: log.author,
              started: new Date(log.started.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')),
              seconds: log.seconds,
              comment: log.comment,
            })),
            skipDuplicates: true,
          }),
        ]);
      } catch (error) {
        this.logger.warn(`Could not read the time log of ${child.key}: ${message(error)}`);
      }
    }
  }

  async timeLog(from: string, to: string, projectIds: string[] | null = null) {
    const rows = await this.prisma.jiraWorklog.findMany({
      where: {
        started: { gte: new Date(`${from}T00:00:00.000Z`), lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000) },
        ...(projectIds === null
          ? {}
          : { upgradeAction: { deployments: { some: { deployment: { projectId: { in: projectIds } } } } } }),
      },
      orderBy: { started: 'asc' },
      include: {
        upgradeAction: {
          select: {
            id: true,
            targetVersion: true,
            cycle: { select: { cycle: true, technology: { select: { name: true } } } },
            jiraSubtasks: { select: { issueKey: true, summary: true, url: true } },
          },
        },
      },
    });

    return rows.map((row) => {
      const task = row.upgradeAction.jiraSubtasks.find((t) => t.issueKey === row.issueKey);
      return {
        id: row.id,
        planId: row.upgradeAction.id,
        technology: row.upgradeAction.cycle.technology.name,
        cycle: row.upgradeAction.cycle.cycle,
        targetVersion: row.upgradeAction.targetVersion,
        issueKey: row.issueKey,
        summary: task?.summary ?? row.issueKey,
        url: task?.url ?? null,
        author: row.author,
        started: row.started.toISOString(),
        seconds: row.seconds,
        comment: row.comment,
      };
    });
  }

  private async subtaskContext(actionId: string, key: string) {
    const action = await this.mustExist(actionId);
    if (!action.jiraKey) {
      throw new BadRequestException('That plan is not linked to an issue.');
    }
    const owned = await this.prisma.jiraSubtask.findFirst({
      where: { upgradeActionId: actionId, issueKey: key.toUpperCase() },
      select: { id: true },
    });
    if (!owned) {
      throw new NotFoundException(`${key} is not a sub-task of this plan.`);
    }
    return { action, tracker: await this.trackerFor(action.jiraIntegrationId) };
  }

  private async mustExist(actionId: string) {
    const action = await this.prisma.upgradeAction.findUnique({
      where: { id: actionId },
      select: { id: true, jiraKey: true, jiraIntegrationId: true },
    });

    if (!action) {
      throw new NotFoundException('No such plan.');
    }

    return action;
  }

  private async trackerFor(
    integrationId: string | null,
    projectKey?: string | null,
  ): Promise<IssueTracker> {
    if (integrationId) {
      return this.integrations.jiraFor(integrationId, projectKey);
    }
    if (projectKey && !this.config.demo && this.config.configured && projectKey !== this.config.projectKey) {
      return new JiraAdapter({ ...this.config, projectKey, configured: true } as JiraConfig);
    }
    return this.tracker;
  }

  private async projectConnection(actionId: string) {
    const link = await this.prisma.upgradeActionDeployment.findFirst({
      where: { upgradeActionId: actionId },
      orderBy: { deploymentId: 'asc' },
      select: {
        deployment: {
          select: { project: { select: { jiraIntegrationId: true, jiraProjectKey: true } } },
        },
      },
    });
    const project = link?.deployment.project;
    return {
      integrationId: project?.jiraIntegrationId ?? null,
      projectKey: project?.jiraProjectKey ?? null,
    };
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'the request failed';
}

function isoDay(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function toSubtask(task: {
  issueKey: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee: string | null;
  url: string;
  startDate: Date | null;
  dueDate: Date | null;
  estimateSeconds: number | null;
  spentSeconds: number | null;
  remainingSeconds: number | null;
}) {
  return {
    key: task.issueKey,
    summary: task.summary,
    status: task.status,
    statusCategory: task.statusCategory,
    assignee: task.assignee,
    url: task.url,
    startDate: isoDay(task.startDate),
    dueDate: isoDay(task.dueDate),
    estimateSeconds: task.estimateSeconds,
    spentSeconds: task.spentSeconds,
    remainingSeconds: task.remainingSeconds,
  };
}

export { parseDuration };

function subtaskFields(issue: TrackedIssue) {
  return {
    startDate: issue.startDate ? new Date(`${issue.startDate}T00:00:00.000Z`) : null,
    dueDate: issue.dueDate ? new Date(`${issue.dueDate}T00:00:00.000Z`) : null,
    estimateSeconds: issue.estimateSeconds ?? null,
    spentSeconds: issue.spentSeconds ?? null,
    remainingSeconds: issue.remainingSeconds ?? null,
  };
}
