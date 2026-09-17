import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

export const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Keeps the worker process alive and reports liveness.
 *
 * A worker has no HTTP server; without at least one active timer Node would
 * exit as soon as bootstrap finished. The scheduled jobs from Phase 7 onward
 * register alongside this one.
 */
@Injectable()
export class WorkerHeartbeatService {
  private readonly logger = new Logger(WorkerHeartbeatService.name);
  private readonly startedAt = Date.now();

  @Interval('worker-heartbeat', HEARTBEAT_INTERVAL_MS)
  beat(): void {
    const uptimeMinutes = Math.round((Date.now() - this.startedAt) / 60000);
    this.logger.log(`worker alive (uptime ${uptimeMinutes} min)`);
  }
}
