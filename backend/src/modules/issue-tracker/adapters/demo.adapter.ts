import { Injectable } from '@nestjs/common';
import {
  Assignee,
  IssueStatusCategory,
  IssueTracker,
  NewSubtask,
  TrackedIssue,
} from '../ports/issue-tracker.port';

@Injectable()
export class DemoIssueTracker implements IssueTracker {
  readonly name = 'Jira (demo)';
  readonly configured = true;

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

    const done = this.children(normalised).filter(
      (child) => child.statusCategory === 'done',
    ).length;

    return Promise.resolve({
      id: `demo-${normalised}`,
      key: normalised,
      summary: 'Platform upgrade',
      status: done === BREAKDOWN.length ? 'Done' : 'In Progress',
      statusCategory: done === BREAKDOWN.length ? 'done' : 'in-progress',
      assignee: 'Pasindu W',
      url: `https://example.invalid/browse/${normalised}`,
      parentKey: null,
    });
  }

  getChildren(key: string): Promise<TrackedIssue[]> {
    const normalised = key.trim().toUpperCase();

    if (normalised === 'DEMO-404') {
      return Promise.reject(new Error('HTTP 404 Not Found.'));
    }

    return Promise.resolve(this.children(normalised));
  }

  getAssignees(): Promise<Assignee[]> {
    return Promise.resolve(
      ['Dinith', 'Kushantha', 'Pamodha', 'Randula', 'Suran'].map((name) => ({
        id: `demo-${name.toLowerCase()}`,
        name,
      })),
    );
  }

  createSubtask(parentKey: string, input: NewSubtask): Promise<TrackedIssue> {
    const key = `DEMO-${900 + Math.floor(Math.random() * 99)}`;

    return Promise.resolve({
      id: `demo-${key}`,
      key,
      summary: input.summary,
      status: 'To Do',
      statusCategory: 'to-do' as IssueStatusCategory,
      assignee: null,
      url: `https://example.invalid/browse/${key}`,
      parentKey: parentKey.trim().toUpperCase(),
    });
  }

  private children(parentKey: string): TrackedIssue[] {
    const base = Number(parentKey.split('-')[1]) || 100;

    return BREAKDOWN.map((step, index) => {
      const number = base + index + 1;
      const key = `DEMO-${number}`;

      return {
        id: `demo-${key}`,
        key,
        summary: step.summary,
        status: step.status,
        statusCategory: step.category,
        assignee: step.assignee,
        url: `https://example.invalid/browse/${key}`,
        parentKey,
      };
    });
  }
}

const BREAKDOWN: {
  summary: string;
  status: string;
  category: IssueStatusCategory;
  assignee: string | null;
}[] = [
  {
    summary: 'Review release notes and breaking changes',
    status: 'Done',
    category: 'done',
    assignee: 'Dinith',
  },
  {
    summary: 'Agree the maintenance window with the customer',
    status: 'Done',
    category: 'done',
    assignee: 'Pamodha',
  },
  {
    summary: 'Snapshot each host and verify the restore',
    status: 'Done',
    category: 'done',
    assignee: 'Kushantha',
  },
  {
    summary: 'Run the upgrade on DEV',
    status: 'In Progress',
    category: 'in-progress',
    assignee: 'Dinith',
  },
  {
    summary: 'Regression test the core flows',
    status: 'To Do',
    category: 'to-do',
    assignee: 'Randula',
  },
  {
    summary: 'Run the upgrade on UAT',
    status: 'To Do',
    category: 'to-do',
    assignee: 'Dinith',
  },
  {
    summary: 'Customer sign-off on UAT',
    status: 'To Do',
    category: 'to-do',
    assignee: 'Pamodha',
  },
  {
    summary: 'Run the upgrade on PROD',
    status: 'To Do',
    category: 'to-do',
    assignee: 'Suran',
  },
  {
    summary: 'Record the version change in the lifecycle registry',
    status: 'To Do',
    category: 'to-do',
    assignee: null,
  },
];
