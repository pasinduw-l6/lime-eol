import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

export const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;

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
