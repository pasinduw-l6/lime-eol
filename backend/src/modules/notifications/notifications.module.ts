import { Module } from '@nestjs/common';
import { TeamsAdapter } from './adapters/teams.adapter';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_CHANNEL } from './ports/notification-channel.port';

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
