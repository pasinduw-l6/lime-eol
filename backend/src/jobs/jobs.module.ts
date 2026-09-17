import { Module } from '@nestjs/common';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

/**
 * Scheduled work. Imported by WorkerModule only — the API must never run jobs.
 */
@Module({
  providers: [WorkerHeartbeatService],
})
export class JobsModule {}
