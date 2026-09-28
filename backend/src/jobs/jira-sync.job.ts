import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { jiraConfig, JiraConfig } from '../config';
import { IssueTrackerService } from '../modules/issue-tracker/issue-tracker.service';

/**
 * Keeps the Jira mirror current.
 *
 * Polling rather than webhooks: Atlassian would have to reach this application
 * to deliver one, and it runs on an internal network. If that changes, a
 * webhook endpoint can replace this and the rest of the design is unaffected —
 * which is the point of the mirror being a cache.
 *
 * Lives in the worker, never the API, for the same reason the notification
 * pass does: a page load must not trigger outbound traffic.
 */
@Injectable()
export class JiraSyncJob {
  private readonly logger = new Logger(JiraSyncJob.name);

  constructor(
    private readonly tracker: IssueTrackerService,
    @Inject(jiraConfig.KEY) private readonly config: JiraConfig,
  ) {}

  @Cron(process.env['JIRA_SYNC_CRON'] ?? '*/15 * * * *', {
    name: 'jira-sync',
    timeZone: process.env['TZ'] ?? 'Asia/Colombo',
  })
  async run(): Promise<void> {
    if (!this.config.configured) {
      // Logged rather than silent, so "the board never updates" is never a
      // mystery.
      this.logger.debug('Skipped — no Jira credentials are configured.');
      return;
    }

    const { linked, failed } = await this.tracker.syncAll();

    if (linked === 0) {
      this.logger.debug('Nothing linked to Jira yet.');
      return;
    }

    this.logger.log(
      `${linked} linked plan(s) refreshed, ${failed} failed`,
    );
  }
}
