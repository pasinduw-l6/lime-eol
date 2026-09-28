import { Module } from '@nestjs/common';
import { EndOfLifeDateClient } from './adapters/endoflife-date.client';
import { EolLookupService } from './eol-lookup.service';
import { EolSyncController } from './eol-sync.controller';
import { EOL_DATA_SOURCE } from './ports/eol-data-source.port';

@Module({
  controllers: [EolSyncController],
  providers: [
    EndOfLifeDateClient,
    { provide: EOL_DATA_SOURCE, useExisting: EndOfLifeDateClient },
    EolLookupService,
  ],
  exports: [EOL_DATA_SOURCE, EolLookupService],
})
export class EolSyncModule {}
