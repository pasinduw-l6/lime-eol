import { Module } from '@nestjs/common';
import { EolSyncModule } from '../eol-sync/eol-sync.module';
import { TechnologiesController } from './technologies.controller';
import { TechnologiesService } from './technologies.service';

@Module({
  // Registering a technology imports its cycles, so the registry depends on
  // the lifecycle source port rather than reaching for the client directly.
  imports: [EolSyncModule],
  controllers: [TechnologiesController],
  providers: [TechnologiesService],
  exports: [TechnologiesService],
})
export class TechnologiesModule {}
