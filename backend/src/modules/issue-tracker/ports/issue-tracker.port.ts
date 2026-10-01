export const ISSUE_TRACKER = Symbol('ISSUE_TRACKER');

export type IssueStatusCategory = 'to-do' | 'in-progress' | 'done' | 'unknown';

export interface TrackedIssue {
  id: string;
  key: string;
  summary: string;
  status: string;
  statusCategory: IssueStatusCategory;
  assignee: string | null;
  url: string;
  parentKey: string | null;
}

export interface NewSubtask {
  summary: string;
  description: string | null;
  dueDate: string | null;
  assigneeId: string | null;
}

export type NewIssue = NewSubtask;

export interface Assignee {
  id: string;
  name: string;
}

export interface IssueTracker {
  readonly name: string;

  readonly configured: boolean;

  getIssue(key: string): Promise<TrackedIssue>;

  getChildren(key: string): Promise<TrackedIssue[]>;

  createIssue(input: NewIssue): Promise<TrackedIssue>;

  createSubtask(parentKey: string, input: NewSubtask): Promise<TrackedIssue>;

  getAssignees(issueKey: string): Promise<Assignee[]>;

  check(): Promise<{ ok: boolean; detail: string }>;
}
