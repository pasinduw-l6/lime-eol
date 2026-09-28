import { Injectable } from '@nestjs/common';
import {
  IssueStatusCategory,
  IssueTracker,
  TrackedIssue,
} from '../ports/issue-tracker.port';

/**
 * Invented issues, for showing the integration without access to a Jira.
 *
 * This is a demonstration, not test data. It exists so the whole flow — link,
 * mirror, sync, unlink — can be walked through and reviewed before anyone has
 * credentials, and it runs through exactly the same service, endpoints, mirror
 * table and panel the real adapter does. Swapping to real Jira changes one
 * environment variable and nothing else.
 *
 * Four things keep it from ever being mistaken for real:
 *
 * - It is bound only when JIRA_DEMO=true, never as a fallback for missing
 *   credentials. Forgetting to configure Jira yields "not connected".
 * - The environment schema refuses to start with it on in production.
 * - Every key it mints is prefixed DEMO, so even a screenshot reads as fake.
 * - The panel shows a badge saying the issues are not real.
 *
 * What it writes goes only to the jira_subtask mirror, which is a cache by
 * design: unlinking deletes those rows and no registry table is touched.
 */
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

    // A reserved key that always fails, so the error path can be shown too:
    // a link that breaks is as much a part of the flow as one that works.
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
      // The parent tracks its children: still open while any remain.
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

  /**
   * The breakdown, derived from the key so a re-sync does not reshuffle it.
   *
   * Sub-task numbers hang off the parent's own number, so DEMO-101 and
   * DEMO-205 read as different pieces of work rather than the same list twice.
   */
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

/**
 * A realistic shape for a platform upgrade: three done, one running, five
 * waiting — enough to exercise the progress bar, all three status colours and
 * the strikethrough at once.
 *
 * The last step points back at this registry, which is the whole argument for
 * the two tools existing side by side: Jira records that someone did the work,
 * and only the registry records that the deployed version actually changed.
 */
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
