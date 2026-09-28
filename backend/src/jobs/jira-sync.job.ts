import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { jiraConfig, JiraConfig } from '../config';
import { IssueTrackerService } from '../modules/issue-tracker/issue-tracker.service';

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
