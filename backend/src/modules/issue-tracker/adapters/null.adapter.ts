import { Injectable } from '@nestjs/common';
import {
  Assignee,
  IssueTracker,
  TrackedIssue,
} from '../ports/issue-tracker.port';

/**
 * The tracker when none is configured.
 *
 * It exists so the registry runs with an empty .env: no Jira credentials means
 * the panel reports "not connected" and every other part of the application is
 * untouched. Tracking end-of-life dates must never depend on Jira being set up,
 * let alone reachable.
 *
 * It refuses rather than returning empty results, because silently returning
 * nothing would look like an issue with no sub-tasks.
 */
@Injectable()
export class NullIssueTracker implements IssueTracker {
  readonly name = 'Not configured';
  readonly configured = false;

  check(): Promise<{ ok: boolean; detail: string }> {
    return Promise.resolve({
      ok: false,
      detail:
        'No Jira credentials are configured. Set JIRA_BASE_URL, JIRA_EMAIL, ' +
        'JIRA_API_TOKEN and JIRA_PROJECT_KEY.',
    });
  }

  getIssue(): Promise<TrackedIssue> {
    return Promise.reject(new Error('No issue tracker is configured.'));
  }

  getChildren(): Promise<TrackedIssue[]> {
    return Promise.reject(new Error('No issue tracker is configured.'));
  }

  createSubtask(): Promise<TrackedIssue> {
    return Promise.reject(new Error('No issue tracker is configured.'));
  }

  getAssignees(): Promise<Assignee[]> {
    return Promise.reject(new Error('No issue tracker is configured.'));
  }
}
