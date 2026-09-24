import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { toAdaptiveCard } from './adapters/teams.adapter';
import { buildDeadlineCard, buildDigest } from './notifications.renderer';
import { NotificationsService } from './notifications.service';
import { notificationConfig, NotificationConfig } from '../../config';
import { Inject } from '@nestjs/common';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    @Inject(notificationConfig.KEY) private readonly config: NotificationConfig,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Whether anything could actually be delivered right now',
    description:
      'Reports that a webhook is configured, never the URL: it carries a signature.',
  })
  status() {
    return this.notifications.status();
  }

  @Get('log')
  @ApiOperation({ summary: 'What was sent, and what failed, newest first' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  log(@Query('limit') limit?: string) {
    return this.notifications.log(Number(limit) || 50);
  }

  @Get('preview')
  @ApiOperation({
    summary: 'The cards the next run would send, rendered but not sent',
    description:
      'Includes the exact Adaptive Card payload, so a flow can be tried from Power Automate without pointing this at a live channel.',
  })
  @ApiOkResponse({ description: 'Cards and their payloads' })
  async preview() {
    const dues = await this.notifications.due();
    const appUrl = this.config.appBaseUrl;

    const cards =
      dues.length > 5
        ? [buildDigest(dues, appUrl)]
        : dues.map((due) => buildDeadlineCard(due, appUrl));

    return {
      asDigest: dues.length > 5,
      count: dues.length,
      cards: cards.map((card) => ({ card, payload: toAdaptiveCard(card) })),
    };
  }

  @Post('run')
  @ApiOperation({
    summary: 'Run the notification pass now',
    description:
      'Honours NOTIFY_DRY_RUN, which defaults to true — so this renders and records without a request leaving the server unless that is deliberately turned off.',
  })
  run() {
    return this.notifications.run();
  }
}
