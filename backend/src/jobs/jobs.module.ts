import { Module } from '@nestjs/common';
import { EolSyncModule } from '../modules/eol-sync/eol-sync.module';
import { IssueTrackerModule } from '../modules/issue-tracker/issue-tracker.module';
import { VersionFileModule } from '../modules/version-file/version-file.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { EolSyncJob } from './eol-sync.job';
import { JiraSyncJob } from './jira-sync.job';
import { NotificationEventsJob } from './notification-events.job';
import { NotificationsJob } from './notifications.job';
import { VersionFileJob } from './version-file.job';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

@Module({
  imports: [NotificationsModule, IssueTrackerModule, EolSyncModule, VersionFileModule],
  providers: [
    WorkerHeartbeatService,
    NotificationsJob,
    NotificationEventsJob,
    JiraSyncJob,
    EolSyncJob,
    VersionFileJob,
  ],
})
export class JobsModule {}
