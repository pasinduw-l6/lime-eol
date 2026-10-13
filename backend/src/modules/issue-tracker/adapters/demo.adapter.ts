import { Injectable } from '@nestjs/common';
import {
  Assignee,
  IssueChange,
  IssueStatusCategory,
  IssueTracker,
  NewSubtask,
  NewWorklog,
  TrackedIssue,
  Transition,
  Worklog,
} from '../ports/issue-tracker.port';

const HOUR = 3600;
const DAY = 86_400_000;

const STATUSES: { name: string; category: IssueStatusCategory }[] = [
  { name: 'To Do', category: 'to-do' },
  { name: 'In Progress', category: 'in-progress' },
  { name: 'Done', category: 'done' },
];

const PEOPLE = ['Dinith', 'Kushantha', 'Pamodha', 'Randula', 'Suran'];

@Injectable()
export class DemoIssueTracker implements IssueTracker {
  readonly name = 'Jira (demo)';
  readonly configured = true;

  private readonly issues = new Map<string, TrackedIssue>();
  private readonly childrenOf = new Map<string, string[]>();
  private readonly worklogs = new Map<string, Worklog[]>();
  private next = 900;

  check(): Promise<{ ok: boolean; detail: string }> {
    return Promise.resolve({
      ok: true,
      detail: 'Demo mode. These issues are invented — no Jira is connected.',
    });
  }

  getIssue(key: string): Promise<TrackedIssue> {
    const normalised = key.trim().toUpperCase();

    if (normalised === 'DEMO-404') {
      return Promise.reject(
        new Error('HTTP 404 Not Found: Issue does not exist or you do not have permission to see it.'),
      );
    }

    const known = this.issues.get(normalised);
    if (known) return Promise.resolve({ ...known });

    const children = this.ensureChildren(normalised);
    const done = children.filter((child) => child.statusCategory === 'done').length;

    const parent: TrackedIssue = {
      id: `demo-${normalised}`,
      key: normalised,
      summary: 'Platform upgrade',
      status: done === children.length ? 'Done' : 'In Progress',
      statusCategory: done === children.length ? 'done' : 'in-progress',
      assignee: 'Pasindu W',
      url: `https://example.invalid/browse/${normalised}`,
      parentKey: null,
    };
    return Promise.resolve(parent);
  }

  getChildren(key: string): Promise<TrackedIssue[]> {
    const normalised = key.trim().toUpperCase();

    if (normalised === 'DEMO-404') {
      return Promise.reject(new Error('HTTP 404 Not Found.'));
    }

    return Promise.resolve(this.ensureChildren(normalised).map((child) => ({ ...child })));
  }

  getAssignees(): Promise<Assignee[]> {
    return Promise.resolve(PEOPLE.map((name) => ({ id: `demo-${name.toLowerCase()}`, name })));
  }

  createIssue(input: NewSubtask): Promise<TrackedIssue> {
    const key = `DEMO-${100 + Math.floor(Math.random() * 700) * 10}`;
    const issue: TrackedIssue = {
      id: `demo-${key}`,
      key,
      summary: input.summary,
      status: 'To Do',
      statusCategory: 'to-do',
      assignee: null,
      url: `https://example.invalid/browse/${key}`,
      parentKey: null,
      dueDate: input.dueDate,
    };
    this.childrenOf.set(key, []);
    return Promise.resolve(issue);
  }

  createSubtask(parentKey: string, input: NewSubtask): Promise<TrackedIssue> {
    const parent = parentKey.trim().toUpperCase();
    const children = this.ensureChildren(parent);
    const key = `DEMO-${this.next++}`;

    const issue: TrackedIssue = {
      id: `demo-${key}`,
      key,
      summary: input.summary,
      status: 'To Do',
      statusCategory: 'to-do',
      assignee: input.assigneeId ? nameOf(input.assigneeId) : null,
      url: `https://example.invalid/browse/${key}`,
      parentKey: parent,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate,
      estimateSeconds: input.estimateSeconds ?? null,
      spentSeconds: null,
      remainingSeconds: input.estimateSeconds ?? null,
    };

    this.issues.set(key, issue);
    this.childrenOf.set(parent, [...children.map((c) => c.key), key]);
    return Promise.resolve({ ...issue });
  }

  updateIssue(key: string, change: IssueChange): Promise<TrackedIssue> {
    const issue = this.mustFind(key);

    if (change.summary !== undefined) issue.summary = change.summary;
    if (change.assigneeId !== undefined) issue.assignee = change.assigneeId ? nameOf(change.assigneeId) : null;
    if (change.startDate !== undefined) issue.startDate = change.startDate;
    if (change.dueDate !== undefined) issue.dueDate = change.dueDate;
    if (change.estimateSeconds !== undefined) {
      issue.estimateSeconds = change.estimateSeconds;
      issue.remainingSeconds = Math.max(0, (change.estimateSeconds ?? 0) - (issue.spentSeconds ?? 0));
    }
    return Promise.resolve({ ...issue });
  }

  getTransitions(key: string): Promise<Transition[]> {
    const issue = this.mustFind(key);
    return Promise.resolve(
      STATUSES.filter((s) => s.name !== issue.status).map((s, index) => ({
        id: String(index + 11),
        name: s.name,
        to: s.name,
        category: s.category,
      })),
    );
  }

  transition(key: string, transitionId: string): Promise<TrackedIssue> {
    const issue = this.mustFind(key);
    const target = STATUSES.filter((s) => s.name !== issue.status)[Number(transitionId) - 11];
    if (!target) return Promise.reject(new Error('That transition is not available.'));
    issue.status = target.name;
    issue.statusCategory = target.category;
    return Promise.resolve({ ...issue });
  }

  getWorklogs(key: string): Promise<Worklog[]> {
    this.mustFind(key);
    return Promise.resolve([...(this.worklogs.get(key) ?? [])]);
  }

  addWorklog(key: string, entry: NewWorklog): Promise<Worklog> {
    const issue = this.mustFind(key);
    const log: Worklog = {
      id: `${key}-${Date.now()}`,
      author: 'You (demo)',
      started: `${entry.date}T09:00:00.000+0000`,
      seconds: entry.seconds,
      comment: entry.comment,
    };
    this.worklogs.set(key, [log, ...(this.worklogs.get(key) ?? [])]);
    issue.spentSeconds = (issue.spentSeconds ?? 0) + entry.seconds;
    issue.remainingSeconds = Math.max(0, (issue.estimateSeconds ?? 0) - issue.spentSeconds);
    return Promise.resolve(log);
  }

  private mustFind(key: string): TrackedIssue {
    const issue = this.issues.get(key.trim().toUpperCase());
    if (!issue) throw new Error(`HTTP 404 Not Found: ${key} is not a demo sub-task.`);
    return issue;
  }

  private ensureChildren(parentKey: string): TrackedIssue[] {
    const existing = this.childrenOf.get(parentKey);
    if (existing) return existing.map((key) => this.issues.get(key)!).filter(Boolean);

    const base = Number(parentKey.split('-')[1]) || 100;
    const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    let cursor = today - 10 * DAY;
    const keys: string[] = [];

    BREAKDOWN.forEach((step, index) => {
      const key = `DEMO-${base + index + 1}`;
      const start = cursor;
      const end = cursor + (step.days - 1) * DAY;
      cursor = end + DAY;
      const estimate = step.hours * HOUR;
      const spent = step.category === 'done' ? estimate : step.category === 'in-progress' ? Math.round(estimate / 2) : 0;

      this.issues.set(key, {
        id: `demo-${key}`,
        key,
        summary: step.summary,
        status: step.status,
        statusCategory: step.category,
        assignee: step.assignee,
        url: `https://example.invalid/browse/${key}`,
        parentKey,
        startDate: iso(start),
        dueDate: iso(end),
        estimateSeconds: estimate,
        spentSeconds: spent || null,
        remainingSeconds: estimate - spent,
      });
      if (spent > 0) {
        const first = Math.ceil(spent / 2 / 1800) * 1800;
        this.worklogs.set(
          key,
          [
            { id: `${key}-1`, author: step.assignee ?? 'Someone', started: `${iso(start)}T09:00:00.000+0000`, seconds: first, comment: 'Started' },
            { id: `${key}-2`, author: step.assignee ?? 'Someone', started: `${iso(Math.max(start, end - DAY))}T09:00:00.000+0000`, seconds: spent - first, comment: null },
          ].filter((log) => log.seconds > 0),
        );
      }
      keys.push(key);
    });

    this.childrenOf.set(parentKey, keys);
    return keys.map((key) => this.issues.get(key)!);
  }
}

function iso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function nameOf(accountId: string): string {
  const name = accountId.replace(/^demo-/, '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const BREAKDOWN: {
  summary: string;
  status: string;
  category: IssueStatusCategory;
  assignee: string | null;
  days: number;
  hours: number;
}[] = [
  { summary: 'Review release notes and breaking changes', status: 'Done', category: 'done', assignee: 'Dinith', days: 2, hours: 4 },
  { summary: 'Agree the maintenance window with the customer', status: 'Done', category: 'done', assignee: 'Pamodha', days: 3, hours: 2 },
  { summary: 'Snapshot each host and verify the restore', status: 'Done', category: 'done', assignee: 'Kushantha', days: 2, hours: 6 },
  { summary: 'Run the upgrade on DEV', status: 'In Progress', category: 'in-progress', assignee: 'Dinith', days: 4, hours: 8 },
  { summary: 'Regression test the core flows', status: 'To Do', category: 'to-do', assignee: 'Randula', days: 3, hours: 12 },
  { summary: 'Run the upgrade on UAT', status: 'To Do', category: 'to-do', assignee: 'Dinith', days: 3, hours: 8 },
  { summary: 'Customer sign-off on UAT', status: 'To Do', category: 'to-do', assignee: 'Pamodha', days: 5, hours: 2 },
  { summary: 'Run the upgrade on PROD', status: 'To Do', category: 'to-do', assignee: 'Suran', days: 2, hours: 8 },
  { summary: 'Record the version change in the lifecycle registry', status: 'To Do', category: 'to-do', assignee: null, days: 1, hours: 1 },
];
