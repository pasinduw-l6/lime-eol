import { Module } from '@nestjs/common';
import { TeamsAdapter } from './adapters/teams.adapter';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_CHANNEL } from './ports/notification-channel.port';

/**
 * Binds NOTIFICATION_CHANNEL to the Teams adapter.
 *
 * Adding email or Slack is another provider bound to the same symbol, not a
 * change to the service — which is why the service never mentions Teams.
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    TeamsAdapter,
    { provide: NOTIFICATION_CHANNEL, useExisting: TeamsAdapter },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
