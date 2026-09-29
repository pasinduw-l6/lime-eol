import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { jiraConfig, JiraConfig } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ISSUE_TRACKER,
  IssueTracker,
  TrackedIssue,
} from './ports/issue-tracker.port';

const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;

@Injectable()
export class IssueTrackerService {
  private readonly logger = new Logger(IssueTrackerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ISSUE_TRACKER) private readonly tracker: IssueTracker,
    @Inject(jiraConfig.KEY) private readonly config: JiraConfig,
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

  async link(actionId: string, issueKey: string) {
    const key = issueKey.trim().toUpperCase();

    if (!ISSUE_KEY.test(key)) {
      throw new BadRequestException(
        'That does not look like a Jira key. Expected something like OPS-1042.',
      );
    }

    await this.mustExist(actionId);

    let issue: TrackedIssue;
    try {
      issue = await this.tracker.getIssue(key);
    } catch (error) {
      throw new BadRequestException(
        `Could not read ${key} from Jira: ${message(error)}`,
      );
    }

    await this.prisma.upgradeAction.update({
      where: { id: actionId },
      data: {
        jiraKey: issue.key,
        jiraIssueId: issue.id,
        jiraUrl: issue.url,
        jiraSyncError: null,
      },
    });

    return this.sync(actionId);
  }

  /**
   * Creates the Jira issue for a plan, with one sub-task per environment it
   * affects, and links it.
   *
   * Refuses when a plan is already linked. Creating a second ticket for the
   * same upgrade is worse than creating none: both drift, and neither is
   * obviously the real one.
   */
  async createFor(actionId: string) {
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

    if (!this.tracker.configured) {
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
      issue = await this.tracker.createIssue({
        summary,
        description,
        dueDate: action.plannedDate?.toISOString().slice(0, 10) ?? null,
        assigneeId: null,
      });
    } catch (error) {
      // Recorded rather than thrown away, so the plan carries the reason it has
      // no ticket and the next attempt is an informed one.
      await this.prisma.upgradeAction.update({
        where: { id: actionId },
        data: { jiraSyncError: `Could not create the issue: ${message(error)}` },
      });
      throw new BadRequestException(`Jira refused that: ${message(error)}`);
    }

    await this.prisma.upgradeAction.update({
      where: { id: actionId },
      data: {
        jiraKey: issue.key,
        jiraIssueId: issue.id,
        jiraUrl: issue.url,
        jiraSyncError: null,
      },
    });

    // One step per environment. A sub-task that fails is logged and skipped:
    // the parent exists and is linked, and losing the whole ticket because the
    // fourth of five steps was refused would be the wrong trade.
    for (const environment of environments) {
      try {
        await this.tracker.createSubtask(issue.key, {
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
      const [issue, children] = await Promise.all([
        this.tracker.getIssue(action.jiraKey),
        this.tracker.getChildren(action.jiraKey),
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
    if (!this.tracker.configured) {
      return { linked: 0, failed: 0 };
    }

    const actions = await this.prisma.upgradeAction.findMany({
      where: { jiraKey: { not: null } },
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
    input: { summary: string; description?: string; dueDate?: string; assigneeId?: string },
  ) {
    const action = await this.mustExist(actionId);

    if (!action.jiraKey) {
      throw new BadRequestException(
        'Link this plan to an issue before adding steps to it.',
      );
    }

    let created;
    try {
      created = await this.tracker.createSubtask(action.jiraKey, {
        summary: input.summary.trim(),
        description: input.description?.trim() || null,
        dueDate: input.dueDate || null,
        assigneeId: input.assigneeId || null,
      });
    } catch (error) {
      throw new BadRequestException(`Jira refused that: ${message(error)}`);
    }

    const mirror = await this.sync(actionId);

    if (mirror.subtasks.some((task) => task.key === created.key)) {
      return mirror;
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
        position: (last?.position ?? -1) + 1,
      },
    });

    await this.prisma.upgradeAction.update({
      where: { id: actionId },
      data: { jiraSubtaskTotal: mirror.total + 1 },
    });

    return this.read(actionId);
  }

  async assignees(actionId: string) {
    const action = await this.mustExist(actionId);

    if (!action.jiraKey) {
      return [];
    }

    try {
      return await this.tracker.getAssignees(action.jiraKey);
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
      subtasks: action.jiraSubtasks.map((task) => ({
        key: task.issueKey,
        summary: task.summary,
        status: task.status,
        statusCategory: task.statusCategory,
        assignee: task.assignee,
        url: task.url,
      })),
    };
  }

  private async mustExist(actionId: string) {
    const action = await this.prisma.upgradeAction.findUnique({
      where: { id: actionId },
      select: { id: true, jiraKey: true },
    });

    if (!action) {
      throw new NotFoundException('No such plan.');
    }

    return action;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'the request failed';
}
