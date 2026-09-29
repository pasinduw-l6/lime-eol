import { Injectable } from '@nestjs/common';
import {
  Assignee,
  IssueTracker,
  TrackedIssue,
} from '../ports/issue-tracker.port';

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

  createIssue(): Promise<TrackedIssue> {
    return Promise.reject(new Error('No issue tracker is configured.'));
  }

  createSubtask(): Promise<TrackedIssue> {
    return Promise.reject(new Error('No issue tracker is configured.'));
  }

  getAssignees(): Promise<Assignee[]> {
    return Promise.reject(new Error('No issue tracker is configured.'));
  }
}
