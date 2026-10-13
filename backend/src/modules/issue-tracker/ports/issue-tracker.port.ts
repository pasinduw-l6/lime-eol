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
  startDate?: string | null;
  dueDate?: string | null;
  estimateSeconds?: number | null;
  spentSeconds?: number | null;
  remainingSeconds?: number | null;
}

export interface NewSubtask {
  summary: string;
  description: string | null;
  dueDate: string | null;
  assigneeId: string | null;
  startDate?: string | null;
  estimateSeconds?: number | null;
}

export type NewIssue = NewSubtask;

export interface IssueChange {
  summary?: string;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimateSeconds?: number | null;
}

export interface Transition {
  id: string;
  name: string;
  to: string;
  category: IssueStatusCategory;
}

export interface Worklog {
  id: string;
  author: string;
  started: string;
  seconds: number;
  comment: string | null;
}

export interface NewWorklog {
  seconds: number;
  date: string;
  comment: string | null;
}

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

  updateIssue(key: string, change: IssueChange): Promise<TrackedIssue>;

  getTransitions(key: string): Promise<Transition[]>;

  transition(key: string, transitionId: string): Promise<TrackedIssue>;

  getWorklogs(key: string): Promise<Worklog[]>;

  addWorklog(key: string, entry: NewWorklog): Promise<Worklog>;

  getAssignees(issueKey: string): Promise<Assignee[]>;

  check(): Promise<{ ok: boolean; detail: string }>;
}
