/**
 * Where the work is actually managed.
 *
 * Consumers depend on this, never on Jira directly — the same shape as
 * EOL_DATA_SOURCE and NOTIFICATION_CHANNEL. If the company ever moves to Azure
 * DevOps or Linear, that is another adapter bound to this symbol rather than a
 * rewrite of the service.
 */
export const ISSUE_TRACKER = Symbol('ISSUE_TRACKER');

/**
 * Jira's own status grouping.
 *
 * Deliberately not the status name: workflows get renamed and differ per
 * project, but the category is stable, so this is what the UI colours by.
 */
export type IssueStatusCategory = 'to-do' | 'in-progress' | 'done' | 'unknown';

export interface TrackedIssue {
  /** Jira's immutable id. Survives an issue moving project. */
  id: string;
  /** What a person types and reads, e.g. OPS-1042. */
  key: string;
  summary: string;
  status: string;
  statusCategory: IssueStatusCategory;
  assignee: string | null;
  url: string;
  /** Present for sub-tasks, absent for the epic or task above them. */
  parentKey: string | null;
}

/** What a new issue needs. Descriptions are plain text here; the adapter is
 *  responsible for whatever format its tracker wants. */
export interface NewIssue {
  summary: string;
  description: string;
  /** Sub-tasks pass the parent's key; a top-level issue passes null. */
  parentKey: string | null;
  /** ISO date, or null to leave it unset. */
  dueDate: string | null;
  labels: string[];
}

export interface IssueTracker {
  /** Named in the UI, so a panel says where the work lives. */
  readonly name: string;

  /** False when nothing is configured — the UI says so rather than failing. */
  readonly configured: boolean;

  /** Throws if the issue does not exist or cannot be read. */
  getIssue(key: string): Promise<TrackedIssue>;

  /** Sub-tasks of an issue, in Jira's own order. */
  getChildren(key: string): Promise<TrackedIssue[]>;

  /** A quick reachability and credential check for the status endpoint. */
  check(): Promise<{ ok: boolean; detail: string }>;
}
