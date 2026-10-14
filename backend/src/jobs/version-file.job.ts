import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VersionFileService } from '../modules/version-file/version-file.service';

@Injectable()
export class VersionFileJob {
  private readonly logger = new Logger(VersionFileJob.name);

  constructor(private readonly versions: VersionFileService) {}

  @Cron(process.env['VERSIONS_SYNC_CRON'] ?? '*/15 * * * *', {
    name: 'version-file-sync',
    timeZone: process.env['TZ'] ?? 'Asia/Colombo',
  })
  async run(): Promise<void> {
    const result = await this.versions.sync();
    if (result.status === 'ERROR') this.logger.warn(result.message);
  }
}
