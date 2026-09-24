import { Module } from '@nestjs/common';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { NotificationsJob } from './notifications.job';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

/**
 * Scheduled work. Imported by WorkerModule only — the API must never run jobs.
 */
@Module({
  imports: [NotificationsModule],
  providers: [WorkerHeartbeatService, NotificationsJob],
})
export class JobsModule {}
