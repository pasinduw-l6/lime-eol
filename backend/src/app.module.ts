import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { LimeReleasesModule } from './modules/lime-releases/lime-releases.module';
import { ReportsModule } from './modules/reports/reports.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AccessModule } from './modules/access/access.module';
import { RolesModule } from './modules/roles/roles.module';
import { VersionFileModule } from './modules/version-file/version-file.module';
import { ProjectAccessGuard } from './modules/access/access.guard';
import { AppConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { EditorGuard } from './modules/auth/guards/editor.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { CustomersModule } from './modules/customers/customers.module';
import { DeploymentsModule } from './modules/deployments/deployments.module';
import { EolSyncModule } from './modules/eol-sync/eol-sync.module';
import { HealthModule } from './modules/health/health.module';
import { IssueTrackerModule } from './modules/issue-tracker/issue-tracker.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TeamsModule } from './modules/teams/teams.module';
import { TechnologiesModule } from './modules/technologies/technologies.module';
import { UpgradeActionsModule } from './modules/upgrade-actions/upgrade-actions.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AccessModule,
    AuthModule,
    HealthModule,
    EolSyncModule,
    ProjectsModule,
    CustomersModule,
    TechnologiesModule,
    DeploymentsModule,
    UsersModule,
    RolesModule,
    VersionFileModule,
    TeamsModule,
    AuditModule,
    LimeReleasesModule,
    ReportsModule,
    IntegrationsModule,
    NotificationsModule,
    UpgradeActionsModule,
    IssueTrackerModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: EditorGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ProjectAccessGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
