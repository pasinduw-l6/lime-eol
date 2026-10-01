import { Module } from '@nestjs/common';
import { EolSyncModule } from '../eol-sync/eol-sync.module';
import { TeamsAdapter } from './adapters/teams.adapter';
import { EolChangeDetector } from './events/eol-change.detector';
import { EstateDetector } from './events/estate.detector';
import { JiraDetector } from './events/jira.detector';
import { NotificationEventsService } from './events/notification-events.service';
import { PlanDetector } from './events/plan.detector';
import { NotificationsController } from './notifications.controller';
import { OpsNotificationsController } from './ops/ops-notifications.controller';
import { OpsNotificationsService } from './ops/ops-notifications.service';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_CHANNEL } from './ports/notification-channel.port';

@Module({
  imports: [EolSyncModule],
  controllers: [NotificationsController, OpsNotificationsController],
  providers: [
    TeamsAdapter,
    { provide: NOTIFICATION_CHANNEL, useExisting: TeamsAdapter },
    NotificationsService,
    EstateDetector,
    PlanDetector,
    JiraDetector,
    EolChangeDetector,
    NotificationEventsService,
    OpsNotificationsService,
  ],
  exports: [NotificationsService, NotificationEventsService],
})
export class NotificationsModule {}
