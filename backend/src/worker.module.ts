import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/config.module';
import { JobsModule } from './jobs/jobs.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Worker entry module: same codebase, no HTTP surface.
 * Cron jobs (EOL sync, notifications) register in JobsModule from Phase 7 on.
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    JobsModule,
  ],
})
export class WorkerModule {}
