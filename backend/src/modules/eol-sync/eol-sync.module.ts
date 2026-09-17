import { Module } from '@nestjs/common';
import { EndOfLifeDateClient } from './adapters/endoflife-date.client';
import { EolLookupService } from './eol-lookup.service';
import { EolSyncController } from './eol-sync.controller';
import { EOL_DATA_SOURCE } from './ports/eol-data-source.port';

/**
 * Binds the EOL_DATA_SOURCE port to the endoflife.date adapter.
 * Swapping providers, or faking one in tests, means changing this line only.
 */
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
