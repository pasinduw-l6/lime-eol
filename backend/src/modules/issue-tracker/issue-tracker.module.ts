import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JIRA_CONFIG_KEY, JiraConfig } from '../../config';
import { DemoIssueTracker } from './adapters/demo.adapter';
import { JiraAdapter } from './adapters/jira.adapter';
import { NullIssueTracker } from './adapters/null.adapter';
import { IssueTrackerController } from './issue-tracker.controller';
import { IssueTrackerService } from './issue-tracker.service';
import { ISSUE_TRACKER } from './ports/issue-tracker.port';

@Module({
  controllers: [IssueTrackerController],
  providers: [
    DemoIssueTracker,
    JiraAdapter,
    NullIssueTracker,
    {
      provide: ISSUE_TRACKER,
      inject: [ConfigService, DemoIssueTracker, JiraAdapter, NullIssueTracker],
      useFactory: (
        config: ConfigService,
        demo: DemoIssueTracker,
        jira: JiraAdapter,
        none: NullIssueTracker,
      ) => {
        const settings = config.getOrThrow<JiraConfig>(JIRA_CONFIG_KEY);
        const logger = new Logger('IssueTracker');

        if (settings.demo) {
          logger.warn(
            settings.configured
              ? 'JIRA_DEMO=true — serving invented issues and ignoring the configured Jira.'
              : 'JIRA_DEMO=true — serving invented issues. No Jira is connected.',
          );
          return demo;
        }

        logger.log(
          settings.configured
            ? `Jira at ${settings.baseUrl} (project ${settings.projectKey})`
            : 'No Jira configured — plans will show as not connected.',
        );
        return settings.configured ? jira : none;
      },
    },
    IssueTrackerService,
  ],
  exports: [IssueTrackerService],
})
export class IssueTrackerModule {}
