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

/** Jira keys look like ABC-123. Checked here so a typo fails before a request. */
const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;

@Injectable()
export class IssueTrackerService {
  private readonly logger = new Logger(IssueTrackerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ISSUE_TRACKER) private readonly tracker: IssueTracker,
    @Inject(jiraConfig.KEY) private readonly config: JiraConfig,
  ) {}

  /**
   * Whether anything could be fetched right now.
   *
   * Reports that credentials exist, never what they are — the same rule the
   * Teams webhook follows. `reachable` costs a request, so it is only run when
   * something is configured.
   */
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
      /// The panel badges itself off this, so invented issues always announce
      /// themselves on screen.
      demo: this.config.demo,
      /// Which environment variables are still blank, so setting Jira up later
      /// is a checklist rather than guesswork. Names only — never values.
      missing: this.config.missing,
      projectKey: this.config.projectKey ?? null,
      baseUrl: this.config.baseUrl ?? null,
      cron: this.config.cron,
    };
  }

  /**
   * Points an upgrade action at an issue that already exists.
   *
   * The issue is fetched before anything is written, so a bad key or an issue
   * nobody can see fails loudly instead of storing a link that never resolves.
   */
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
   * Forgets the link. The Jira issue is left completely alone — this tool does
   * not delete other people's work.
   */
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

  /**
   * Refreshes one action's mirror from Jira.
   *
   * A failure is recorded on the row rather than thrown: the panel should be
   * able to say "last synced an hour ago, and the last attempt failed because
   * X" instead of showing nothing at all.
   */
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
        // Replaced wholesale rather than merged: a sub-task deleted in Jira
        // must disappear here, and diffing to discover that costs more than
        // rewriting a handful of rows.
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

  /**
   * Refreshes every linked action. Run by the worker, never by the API.
   *
   * Sequential on purpose: Jira Cloud rate-limits by cost, and a burst of
   * parallel requests across twenty plans is exactly what trips it.
   */
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

  /** What the panel renders. Reads the mirror only — never calls Jira. */
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
