import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JIRA_CONFIG_KEY, JiraConfig } from '../../config';
import { JiraAdapter } from './adapters/jira.adapter';
import { NullIssueTracker } from './adapters/null.adapter';
import { IssueTrackerController } from './issue-tracker.controller';
import { IssueTrackerService } from './issue-tracker.service';
import { ISSUE_TRACKER } from './ports/issue-tracker.port';

/**
 * Binds ISSUE_TRACKER to Jira when it is configured, and to a null tracker
 * when it is not.
 *
 * Choosing at bind time rather than inside the adapter means an unconfigured
 * deployment has no Jira code in its path at all, and the panel's "not
 * connected" state is a property of the wiring rather than a branch repeated
 * in every method.
 */
@Module({
  controllers: [IssueTrackerController],
  providers: [
    JiraAdapter,
    NullIssueTracker,
    {
      provide: ISSUE_TRACKER,
      inject: [ConfigService, JiraAdapter, NullIssueTracker],
      useFactory: (
        config: ConfigService,
        jira: JiraAdapter,
        none: NullIssueTracker,
      ) => {
        const settings = config.getOrThrow<JiraConfig>(JIRA_CONFIG_KEY);
        return settings.configured ? jira : none;
      },
    },
    IssueTrackerService,
  ],
  exports: [IssueTrackerService],
})
export class IssueTrackerModule {}
