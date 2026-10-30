import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SourceCodeService } from '../modules/source-code/source-code.service';

@Injectable()
export class SourceCodeJob {
  constructor(private readonly source: SourceCodeService) {}

  @Cron(process.env['SOURCE_SCAN_CRON'] ?? '*/15 * * * *', {
    name: 'source-code-scan',
    timeZone: process.env['TZ'] ?? 'Asia/Colombo',
  })
  run(): Promise<void> {
    return this.source.scanAll();
  }
}
