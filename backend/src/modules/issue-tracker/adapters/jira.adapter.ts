import { Inject, Injectable, Logger } from '@nestjs/common';
import { jiraConfig, JiraConfig } from '../../../config';
import {
  Assignee,
  IssueStatusCategory,
  IssueTracker,
  NewIssue,
  NewSubtask,
  TrackedIssue,
} from '../ports/issue-tracker.port';

const MAX_ATTEMPTS = 3;

const PAGE_SIZE = 100;

@Injectable()
export class JiraAdapter implements IssueTracker {
  private readonly logger = new Logger(JiraAdapter.name);

  private cachedCloudId: string | null = null;

  private readonly subtaskTypes = new Map<string, string>();

  private readonly taskTypes = new Map<string, string>();

  readonly name = 'Jira';

  constructor(
    @Inject(jiraConfig.KEY) private readonly config: JiraConfig,
  ) {}

  get configured(): boolean {
    return this.config.configured;
  }

  async check(): Promise<{ ok: boolean; detail: string }> {
    if (!this.configured) {
      return { ok: false, detail: 'No Jira credentials are configured.' };
    }

    const style = this.config.scopedToken ? 'scoped' : 'classic';

    try {
      const me = await this.request<{ displayName?: string }>('/rest/api/3/myself');
      return {
        ok: true,
        detail: `Connected as ${me.displayName ?? 'an unnamed account'} (${style} token).`,
      };
    } catch (error) {
      const detail = message(error);

      const hint =
        detail.includes('401') || detail.includes('403')
          ? ` Sent as a ${style} token — if it is the other kind, set JIRA_TOKEN_TYPE=${
              this.config.scopedToken ? 'classic' : 'scoped'
            }.`
          : '';

      return { ok: false, detail: detail + hint };
    }
  }

  async getIssue(key: string): Promise<TrackedIssue> {
    const issue = await this.request<RawIssue>(
      `/rest/api/3/issue/${encodeURIComponent(key)}` +
        `?fields=summary,status,assignee,parent`,
    );
    return this.toTracked(issue);
  }

  async getChildren(key: string): Promise<TrackedIssue[]> {
    const jql = `parent = "${key.replace(/"/g, '')}" ORDER BY created ASC`;
    const issues: RawIssue[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({
        jql,
        maxResults: String(PAGE_SIZE),
        fields: 'summary,status,assignee,parent',
      });
      if (cursor) {
        params.set('nextPageToken', cursor);
      }

      const page = await this.request<RawSearch>(
        `/rest/api/3/search/jql?${params.toString()}`,
      );
      issues.push(...(page.issues ?? []));
      cursor = page.nextPageToken;
    } while (cursor);

    return issues.map((issue) => this.toTracked(issue));
  }

  async getAssignees(issueKey: string): Promise<Assignee[]> {
    const users = await this.request<RawUser[]>(
      `/rest/api/3/user/assignable/search?issueKey=${encodeURIComponent(issueKey)}&maxResults=50`,
    );

    return users
      .filter((user) => user.active !== false)
      .map((user) => ({ id: user.accountId, name: user.displayName }));
  }

  async createIssue(input: NewIssue): Promise<TrackedIssue> {
    const projectKey = this.config.projectKey;

    if (!projectKey) {
      throw new Error('JIRA_PROJECT_KEY is not set, so there is no board to create in.');
    }

    const issueTypeId = await this.taskTypeId(projectKey);

    return this.post({
      project: { key: projectKey },
      issuetype: { id: issueTypeId },
      ...this.commonFields(input),
    });
  }

  async createSubtask(parentKey: string, input: NewSubtask): Promise<TrackedIssue> {
    const projectKey = parentKey.split('-')[0];
    const issueTypeId = await this.subtaskTypeId(projectKey);

    return this.post({
      project: { key: projectKey },
      parent: { key: parentKey },
      issuetype: { id: issueTypeId },
      ...this.commonFields(input),
    });
  }

  private commonFields(input: NewSubtask): Record<string, unknown> {
    const fields: Record<string, unknown> = { summary: input.summary };

    if (input.description) {
      fields['description'] = toAdf(input.description);
    }
    if (input.dueDate) {
      fields['duedate'] = input.dueDate;
    }
    if (input.assigneeId) {
      fields['assignee'] = { accountId: input.assigneeId };
    }

    return fields;
  }

  private async post(fields: Record<string, unknown>): Promise<TrackedIssue> {
    const created = await this.send<{ key: string }>('/rest/api/3/issue', 'POST', {
      fields,
    });

    return this.getIssue(created.key);
  }

  /**
   * The issue type a plan becomes.
   *
   * Prefers a type literally called Task, because that is what a board like KAN
   * has by default and what people expect to see. Failing that, any type that
   * is not a sub-task will do - an epic is a poor fit but a working one, and a
   * sub-task is not a fit at all: it cannot exist without a parent.
   */
  private async taskTypeId(projectKey: string): Promise<string> {
    const cached = this.taskTypes.get(projectKey);
    if (cached) {
      return cached;
    }

    const meta = await this.request<{ issueTypes?: RawIssueType[] }>(
      `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`,
    );

    const types = (meta.issueTypes ?? []).filter((t) => !t.subtask);
    const type =
      types.find((t) => t.name.toLowerCase() === 'task') ??
      types.find((t) => t.name.toLowerCase() === 'story') ??
      types[0];

    if (!type) {
      throw new Error(
        `Project ${projectKey} has no issue type that can be created on its own. ` +
          'Check Project settings, Issue types.',
      );
    }

    this.taskTypes.set(projectKey, type.id);
    return type.id;
  }

  private async subtaskTypeId(projectKey: string): Promise<string> {
    const cached = this.subtaskTypes.get(projectKey);
    if (cached) {
      return cached;
    }

    const meta = await this.request<{ issueTypes?: RawIssueType[] }>(
      `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`,
    );

    const type = (meta.issueTypes ?? []).find((t) => t.subtask);
    if (!type) {
      throw new Error(
        `Project ${projectKey} has no sub-task issue type enabled. ` +
          'Add one under Project settings, Issue types.',
      );
    }

    this.subtaskTypes.set(projectKey, type.id);
    return type.id;
  }

  private toTracked(issue: RawIssue): TrackedIssue {
    const fields = issue.fields ?? {};
    return {
      id: issue.id,
      key: issue.key,
      summary: fields.summary ?? '(no summary)',
      status: fields.status?.name ?? 'Unknown',
      statusCategory: toCategory(fields.status?.statusCategory?.key),
      assignee: fields.assignee?.displayName ?? null,
      url: `${this.config.baseUrl}/browse/${issue.key}`,
      parentKey: fields.parent?.key ?? null,
    };
  }

  private async apiRoot(): Promise<string> {
    if (!this.config.scopedToken) {
      return this.config.baseUrl!;
    }
    return `https://api.atlassian.com/ex/jira/${await this.cloudId()}`;
  }

  private async cloudId(): Promise<string> {
    if (this.cachedCloudId) {
      return this.cachedCloudId;
    }

    const response = await fetch(`${this.config.baseUrl}/_edge/tenant_info`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `Could not resolve the Jira cloud id from ${this.config.baseUrl} ` +
          `(HTTP ${response.status}). Check JIRA_BASE_URL.`,
      );
    }

    const body = (await response.json()) as { cloudId?: string };
    if (!body.cloudId) {
      throw new Error('The Jira site did not return a cloud id.');
    }

    this.cachedCloudId = body.cloudId;
    this.logger.log(`Jira cloud id resolved for ${this.config.baseUrl}`);
    return body.cloudId;
  }

  private async send<T>(
    path: string,
    method: 'POST' | 'PUT',
    body: unknown,
  ): Promise<T> {
    if (!this.configured) {
      throw new Error('No Jira credentials are configured.');
    }

    const auth = Buffer.from(
      `${this.config.email}:${this.config.apiToken}`,
    ).toString('base64');

    const response = await fetch(`${await this.apiRoot()}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(await describe(response));
    }

    return (await response.json()) as T;
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.configured) {
      throw new Error('No Jira credentials are configured.');
    }

    const url = `${await this.apiRoot()}${path}`;
    const auth = Buffer.from(
      `${this.config.email}:${this.config.apiToken}`,
    ).toString('base64');

    let lastError = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        if (response.ok) {
          return (await response.json()) as T;
        }

        const retryable = response.status === 429 || response.status >= 500;
        lastError = await describe(response);

        if (!retryable || attempt === MAX_ATTEMPTS) {
          break;
        }

        await sleep(backoffFor(attempt, response.headers.get('retry-after')));
      } catch (error) {
        lastError = message(error);
        if (attempt === MAX_ATTEMPTS) {
          break;
        }
        await sleep(backoffFor(attempt, null));
      }
    }

    throw new Error(lastError || 'the request failed');
  }
}

function toCategory(key: string | undefined): IssueStatusCategory {
  switch (key) {
    case 'new':
    case 'undefined':
      return 'to-do';
    case 'indeterminate':
      return 'in-progress';
    case 'done':
      return 'done';
    default:
      return 'unknown';
  }
}

async function describe(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status} ${response.statusText}`.trim();
  try {
    const body = (await response.json()) as {
      errorMessages?: string[];
      errors?: Record<string, string>;
    };
    const parts = [
      ...(body.errorMessages ?? []),
      ...Object.values(body.errors ?? {}),
    ];
    return parts.length > 0 ? `${fallback}: ${parts.join('; ')}` : fallback;
  } catch {
    return fallback;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'the request failed';
}

function backoffFor(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 30_000);
  }
  return attempt * 1500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toAdf(text: string): Record<string, unknown> {
  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    }));

  return {
    type: 'doc',
    version: 1,
    content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph' }],
  };
}

interface RawUser {
  accountId: string;
  displayName: string;
  active?: boolean;
}

interface RawIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

interface RawIssue {
  id: string;
  key: string;
  fields?: {
    summary?: string;
    status?: { name?: string; statusCategory?: { key?: string } };
    assignee?: { displayName?: string } | null;
    parent?: { key?: string } | null;
  };
}

interface RawSearch {
  issues?: RawIssue[];
  nextPageToken?: string;
}
