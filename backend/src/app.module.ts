import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { EditorGuard } from './modules/auth/guards/editor.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
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
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: EditorGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
