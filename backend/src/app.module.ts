import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { EditorGuard } from './modules/auth/guards/editor.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { DeploymentsModule } from './modules/deployments/deployments.module';
import { EolSyncModule } from './modules/eol-sync/eol-sync.module';
import { HealthModule } from './modules/health/health.module';
import { IssueTrackerModule } from './modules/issue-tracker/issue-tracker.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TechnologiesModule } from './modules/technologies/technologies.module';
import { UpgradeActionsModule } from './modules/upgrade-actions/upgrade-actions.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * API entry module. Feature modules are added here as phases land.
 * Scheduled jobs deliberately live in WorkerModule only.
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    EolSyncModule,
    ProjectsModule,
    TechnologiesModule,
    DeploymentsModule,
    UsersModule,
    NotificationsModule,
    UpgradeActionsModule,
    IssueTrackerModule,
  ],
  /**
   * Authentication then authorisation, in that order: EditorGuard reads
   * request.user, which JwtAuthGuard is what puts there.
   *
   * Registered globally so the API is closed by default. Opening a route
   * takes an explicit @Public(), which is visible in review; forgetting a
   * decorator now fails safe instead of exposing an endpoint.
   */
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: EditorGuard },
  ],
})
export class AppModule {}
