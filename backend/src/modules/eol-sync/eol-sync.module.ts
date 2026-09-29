import { Module } from '@nestjs/common';
import { EndOfLifeDateClient } from './adapters/endoflife-date.client';
import { EolLookupService } from './eol-lookup.service';
import { EolSyncController } from './eol-sync.controller';
import { EolSyncService } from './eol-sync.service';
import { EOL_DATA_SOURCE } from './ports/eol-data-source.port';

@Module({
  controllers: [EolSyncController],
  providers: [
    EndOfLifeDateClient,
    { provide: EOL_DATA_SOURCE, useExisting: EndOfLifeDateClient },
    EolLookupService,
    EolSyncService,
  ],
  exports: [EOL_DATA_SOURCE, EolLookupService, EolSyncService],
})
export class EolSyncModule {}
