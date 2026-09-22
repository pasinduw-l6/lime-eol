import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { EolSyncModule } from './modules/eol-sync/eol-sync.module';
import { HealthModule } from './modules/health/health.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TechnologiesModule } from './modules/technologies/technologies.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * API entry module. Feature modules are added here as phases land.
 * Scheduled jobs deliberately live in WorkerModule only.
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    HealthModule,
    EolSyncModule,
    ProjectsModule,
    TechnologiesModule,
  ],
})
export class AppModule {}
