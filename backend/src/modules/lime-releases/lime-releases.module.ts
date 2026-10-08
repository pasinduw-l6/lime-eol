import { Module } from '@nestjs/common';
import { LimeReleasesController } from './lime-releases.controller';
import { LimeReleasesService } from './lime-releases.service';

@Module({
  controllers: [LimeReleasesController],
  providers: [LimeReleasesService],
})
export class LimeReleasesModule {}
