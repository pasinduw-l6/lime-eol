import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JIRA_CONFIG_KEY, JiraConfig } from '../../config';
import { DemoIssueTracker } from './adapters/demo.adapter';
import { JiraAdapter } from './adapters/jira.adapter';
import { NullIssueTracker } from './adapters/null.adapter';
import { IssueTrackerController } from './issue-tracker.controller';
import { IssueTrackerService } from './issue-tracker.service';
import { ISSUE_TRACKER } from './ports/issue-tracker.port';

/**
 * Binds ISSUE_TRACKER to one of three adapters: the demo, real Jira, or
 * nothing at all.
 *
 * Choosing at bind time rather than inside an adapter means an unconfigured
 * deployment has no Jira code in its path, and the panel's "not connected"
 * state is a property of the wiring rather than a branch repeated in every
 * method.
 *
 * Demo takes precedence over real credentials on purpose. Someone who has
 * turned it on wants invented issues; silently preferring the live Jira
 * because credentials happen to be present would be the surprising outcome,
 * and would post a demo walkthrough at a real project. It is logged as a
 * warning every start so it can never be on without anyone noticing.
 */
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
