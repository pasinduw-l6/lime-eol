import { Module } from '@nestjs/common';
import { IssueTrackerModule } from '../modules/issue-tracker/issue-tracker.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { JiraSyncJob } from './jira-sync.job';
import { NotificationsJob } from './notifications.job';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

/**
 * Scheduled work. Imported by WorkerModule only — the API must never run jobs.
 */
@Module({
  imports: [NotificationsModule, IssueTrackerModule],
  providers: [WorkerHeartbeatService, NotificationsJob, JiraSyncJob],
})
export class JobsModule {}
