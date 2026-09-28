import { Inject, Injectable, Logger } from '@nestjs/common';
import { jiraConfig, JiraConfig } from '../../../config';
import {
  IssueStatusCategory,
  IssueTracker,
  TrackedIssue,
} from '../ports/issue-tracker.port';

const MAX_ATTEMPTS = 3;

/** Jira Cloud caps a page at 100; we ask for that and follow the cursor. */
const PAGE_SIZE = 100;

/**
 * Jira Cloud, REST API v3.
 *
 * Four things here are not obvious and are easy to get wrong:
 *
 * - Search is `/rest/api/3/search/jql`. The old `/rest/api/3/search` has been
 *   removed, not merely deprecated, and paging is a `nextPageToken` cursor
 *   rather than `startAt`. Most tutorials still show the old one.
 * - Auth is Basic with `email:apiToken`, which is Cloud's scheme. Data Center
 *   uses a bare bearer PAT instead, which is why this adapter is Cloud-only
 *   and a second adapter would be needed for Data Center.
 * - A scoped token and a classic one are both opaque strings, but they are
 *   sent to different hosts: scoped tokens go through Atlassian's gateway at
 *   api.atlassian.com and need the site's cloud id, classic tokens go to the
 *   site itself. Nothing in the token says which it is, so the type is
 *   configured rather than sniffed.
 * - v3 wants rich text as ADF (nested JSON), not a string. Nothing here writes
 *   yet, so that arrives with provisioning.
 *
 * The token is never logged and never returned. Errors carry status codes and
 * Jira's own message, both of which are safe; the Authorization header is not.
 */
@Injectable()
export class JiraAdapter implements IssueTracker {
  private readonly logger = new Logger(JiraAdapter.name);

  /** Resolved once. A site's cloud id does not change. */
  private cachedCloudId: string | null = null;

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
      // Cheapest authenticated call that proves both reachability and that the
      // credentials are accepted.
      const me = await this.request<{ displayName?: string }>('/rest/api/3/myself');
      return {
        ok: true,
        detail: `Connected as ${me.displayName ?? 'an unnamed account'} (${style} token).`,
      };
    } catch (error) {
      const detail = message(error);

      // The two token types are sent to different hosts, so the wrong setting
      // fails as a 401 that reads like bad credentials. Saying which one was
      // assumed turns a guessing game into a one-line fix.
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
    // `parent = X` covers both sub-tasks and the children of an epic on
    // team-managed projects, which is why it is used rather than `subtasks`.
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
      // `isLast` is absent on older responses, so the cursor is the condition.
    } while (cursor);

    return issues.map((issue) => this.toTracked(issue));
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

  /**
   * Where REST calls go, which depends on the kind of token.
   *
   * A scoped token is rejected at the site URL and a classic one is rejected
   * at the gateway, so getting this wrong produces a 401 that looks like bad
   * credentials rather than a wrong address — which is why the type is
   * configured explicitly and named in the error below.
   */
  private async apiRoot(): Promise<string> {
    if (!this.config.scopedToken) {
      return this.config.baseUrl!;
    }
    return `https://api.atlassian.com/ex/jira/${await this.cloudId()}`;
  }

  /**
   * The site's cloud id, from its own public tenant-info endpoint.
   *
   * Unauthenticated on purpose: it runs before the token is ever used, so a
   * failure here is clearly "the site URL is wrong" rather than "the
   * credentials are wrong". Cached for the life of the process.
   */
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

        // 401/403/404 will not fix themselves — bad credentials are bad every
        // time, and a missing issue stays missing. Only throttling and server
        // faults are worth another attempt.
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

    // Deliberately does not include the URL or any header: this message is
    // stored on the action and shown in the UI.
    throw new Error(lastError || 'the request failed');
  }
}

/** Jira's category keys, mapped to ours. */
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

/** Jira's own error text when it gives one, so a 400 says what was wrong. */
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

/** Honours Retry-After when Jira throttles, else backs off. */
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
