import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EolSyncService } from '../modules/eol-sync/eol-sync.service';

@Injectable()
export class EolSyncJob {
  private readonly logger = new Logger(EolSyncJob.name);

  constructor(private readonly sync: EolSyncService) {}

  @Cron(process.env['SYNC_CRON'] ?? '0 2 * * *', {
    name: 'eol-sync',
    timeZone: process.env['TZ'] ?? 'Asia/Colombo',
  })
  async run(): Promise<void> {
    const result = await this.sync.run();

    for (const failure of result.failures) {
      this.logger.warn(`${failure.technology}: ${failure.reason}`);
    }
  }
}
