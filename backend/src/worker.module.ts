import { AccessModule } from './modules/access/access.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/config.module';
import { JobsModule } from './jobs/jobs.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AccessModule,
    ScheduleModule.forRoot(),
    JobsModule,
  ],
})
export class WorkerModule {}
