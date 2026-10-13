import { Inject, Injectable, Logger } from '@nestjs/common';
import { jiraConfig, JiraConfig } from '../../../config';
import {
  Assignee,
  IssueChange,
  IssueStatusCategory,
  IssueTracker,
  NewIssue,
  NewSubtask,
  NewWorklog,
  TrackedIssue,
  Transition,
  Worklog,
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
    const start = await this.startField();
    const issue = await this.request<RawIssue>(
      `/rest/api/3/issue/${encodeURIComponent(key)}` +
        `?fields=${await this.fieldList()}`,
    );
    return this.toTracked(issue, start);
  }

  async updateIssue(key: string, change: IssueChange): Promise<TrackedIssue> {
    const fields: Record<string, unknown> = {};

    if (change.summary !== undefined) fields['summary'] = change.summary;
    if (change.dueDate !== undefined) fields['duedate'] = change.dueDate;
    if (change.assigneeId !== undefined) {
      fields['assignee'] = change.assigneeId ? { accountId: change.assigneeId } : null;
    }
    if (change.startDate !== undefined) {
      const start = await this.startField();
      if (!start) {
        throw new Error('This Jira site has no "Start date" field, so a start date cannot be saved.');
      }
      fields[start] = change.startDate;
    }
    if (change.estimateSeconds !== undefined && change.estimateSeconds !== null) {
      fields['timetracking'] = { originalEstimate: `${Math.max(1, Math.round(change.estimateSeconds / 60))}m` };
    }

    if (Object.keys(fields).length > 0) {
      await this.send(`/rest/api/3/issue/${encodeURIComponent(key)}`, 'PUT', { fields });
    }
    return this.getIssue(key);
  }

  async getTransitions(key: string): Promise<Transition[]> {
    const body = await this.request<{
      transitions?: { id: string; name: string; to?: { name?: string; statusCategory?: { key?: string } } }[];
    }>(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);

    return (body.transitions ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      to: t.to?.name ?? t.name,
      category: toCategory(t.to?.statusCategory?.key),
    }));
  }

  async transition(key: string, transitionId: string): Promise<TrackedIssue> {
    await this.send(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, 'POST', {
      transition: { id: transitionId },
    });
    return this.getIssue(key);
  }

  async getWorklogs(key: string): Promise<Worklog[]> {
    const body = await this.request<{ worklogs?: RawWorklog[] }>(
      `/rest/api/3/issue/${encodeURIComponent(key)}/worklog?maxResults=100`,
    );
    return (body.worklogs ?? []).map(toWorklog).sort((a, b) => b.started.localeCompare(a.started));
  }

  async addWorklog(key: string, entry: NewWorklog): Promise<Worklog> {
    const created = await this.send<RawWorklog>(
      `/rest/api/3/issue/${encodeURIComponent(key)}/worklog`,
      'POST',
      {
        timeSpentSeconds: entry.seconds,
        started: `${entry.date}T09:00:00.000+0000`,
        ...(entry.comment ? { comment: toAdf(entry.comment) } : {}),
      },
    );
    return toWorklog(created!);
  }

  private startFieldId: string | null | undefined;

  private async startField(): Promise<string | null> {
    if (this.startFieldId !== undefined) return this.startFieldId;
    try {
      const fields = await this.request<{ id: string; name: string; schema?: { type?: string } }[]>(
        '/rest/api/3/field',
      );
      const match =
        fields.find((f) => f.name.toLowerCase() === 'start date' && f.schema?.type === 'date') ??
        fields.find((f) => f.name.toLowerCase() === 'start date');
      this.startFieldId = match?.id ?? null;
    } catch {
      this.startFieldId = null;
    }
    return this.startFieldId;
  }

  private async fieldList(): Promise<string> {
    const start = await this.startField();
    return ['summary', 'status', 'assignee', 'parent', 'duedate', 'timetracking', ...(start ? [start] : [])].join(',');
  }

  async getChildren(key: string): Promise<TrackedIssue[]> {
    const jql = `parent = "${key.replace(/"/g, '')}" ORDER BY created ASC`;
    const issues: RawIssue[] = [];
    const start = await this.startField();
    const fields = await this.fieldList();
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({
        jql,
        maxResults: String(PAGE_SIZE),
        fields,
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

    return issues.map((issue) => this.toTracked(issue, start));
  }

  async getProject(key: string): Promise<{ key: string; name: string }> {
    return this.request<{ key: string; name: string }>(
      `/rest/api/3/project/${encodeURIComponent(key)}`,
    );
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
    const start = input.startDate ? await this.startField() : null;

    return this.post({
      project: { key: projectKey },
      parent: { key: parentKey },
      issuetype: { id: issueTypeId },
      ...this.commonFields(input),
      ...(start ? { [start]: input.startDate } : {}),
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
    if (input.estimateSeconds) {
      fields['timetracking'] = { originalEstimate: `${Math.max(1, Math.round(input.estimateSeconds / 60))}m` };
    }

    return fields;
  }

  private async post(fields: Record<string, unknown>): Promise<TrackedIssue> {
    const created = await this.send<{ key: string }>('/rest/api/3/issue', 'POST', {
      fields,
    });

    return this.getIssue(created!.key);
  }

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

  private toTracked(issue: RawIssue, startField: string | null = null): TrackedIssue {
    const fields = issue.fields ?? {};
    const time = fields.timetracking ?? {};
    const start = startField ? (fields as Record<string, unknown>)[startField] : null;
    return {
      id: issue.id,
      key: issue.key,
      summary: fields.summary ?? '(no summary)',
      status: fields.status?.name ?? 'Unknown',
      statusCategory: toCategory(fields.status?.statusCategory?.key),
      assignee: fields.assignee?.displayName ?? null,
      url: `${this.config.baseUrl}/browse/${issue.key}`,
      parentKey: fields.parent?.key ?? null,
      startDate: typeof start === 'string' ? start.slice(0, 10) : null,
      dueDate: fields.duedate ?? null,
      estimateSeconds: time.originalEstimateSeconds ?? null,
      spentSeconds: time.timeSpentSeconds ?? null,
      remainingSeconds: time.remainingEstimateSeconds ?? null,
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
  ): Promise<T | undefined> {
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

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : undefined;
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
    duedate?: string | null;
    timetracking?: {
      originalEstimateSeconds?: number;
      timeSpentSeconds?: number;
      remainingEstimateSeconds?: number;
    };
  };
}

interface RawWorklog {
  id: string;
  author?: { displayName?: string };
  started?: string;
  timeSpentSeconds?: number;
  comment?: { content?: { content?: { text?: string }[] }[] };
}

function toWorklog(raw: RawWorklog): Worklog {
  const comment = (raw.comment?.content ?? [])
    .flatMap((block) => (block.content ?? []).map((part) => part.text ?? ''))
    .join(' ')
    .trim();
  return {
    id: raw.id,
    author: raw.author?.displayName ?? 'Someone',
    started: raw.started ?? '',
    seconds: raw.timeSpentSeconds ?? 0,
    comment: comment || null,
  };
}

interface RawSearch {
  issues?: RawIssue[];
  nextPageToken?: string;
}
