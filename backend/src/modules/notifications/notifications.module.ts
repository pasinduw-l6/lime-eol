import { Module } from '@nestjs/common';
import { TeamsAdapter } from './adapters/teams.adapter';
import { EolChangeDetector } from './events/eol-change.detector';
import { EstateDetector } from './events/estate.detector';
import { JiraDetector } from './events/jira.detector';
import { NotificationEventsService } from './events/notification-events.service';
import { PlanDetector } from './events/plan.detector';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_CHANNEL } from './ports/notification-channel.port';

@Module({
  controllers: [NotificationsController],
  providers: [
    TeamsAdapter,
    { provide: NOTIFICATION_CHANNEL, useExisting: TeamsAdapter },
    NotificationsService,
    // One detector per kind of thing worth announcing. Adding another is a new
    // provider here and a line in the dispatcher, and nothing else moves.
    EstateDetector,
    PlanDetector,
    JiraDetector,
    EolChangeDetector,
    NotificationEventsService,
  ],
  exports: [NotificationsService, NotificationEventsService],
})
export class NotificationsModule {}
