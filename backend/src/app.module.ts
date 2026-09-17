import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * API entry module. Feature modules are added here as phases land.
 * Scheduled jobs deliberately live in WorkerModule only.
 */
@Module({
  imports: [AppConfigModule, PrismaModule, HealthModule],
})
export class AppModule {}
