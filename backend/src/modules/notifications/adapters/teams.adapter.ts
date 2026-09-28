import { Inject, Injectable, Logger } from '@nestjs/common';
import { notificationConfig, NotificationConfig } from '../../../config';
import {
  NotificationCard,
  NotificationChannel,
} from '../ports/notification-channel.port';

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

@Injectable()
export class TeamsAdapter implements NotificationChannel {
  private readonly logger = new Logger(TeamsAdapter.name);

  readonly name = 'Lime DevOps (Teams)';

  constructor(
    @Inject(notificationConfig.KEY)
    private readonly config: NotificationConfig,
  ) {}

  async send(card: NotificationCard): Promise<void> {
    const payload = toAdaptiveCard(card);

    if (this.config.dryRun) {
      this.logger.log(
        `[dry run] would post "${card.title}" to ${this.name}\n${JSON.stringify(payload, null, 2)}`,
      );
      return;
    }

    const url = this.config.teamsWebhookUrl;
    if (!url) {
      throw new Error('No TEAMS_WEBHOOK_URL is configured.');
    }

    let lastError = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (response.ok) {
          return;
        }

        const retryable = response.status === 429 || response.status >= 500;
        lastError = `HTTP ${response.status} ${response.statusText}`.trim();

        if (!retryable || attempt === MAX_ATTEMPTS) {
          break;
        }

        await sleep(backoffFor(attempt, response.headers.get('retry-after')));
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : 'the request failed';

        if (attempt === MAX_ATTEMPTS) {
          break;
        }
        await sleep(backoffFor(attempt, null));
      }
    }

    throw new Error(lastError || 'the request failed');
  }
}

export function toAdaptiveCard(card: NotificationCard): Record<string, unknown> {
  const body: Record<string, unknown>[] = [
    {
      type: 'TextBlock',
      text: card.heading,
      weight: 'Bolder',
      size: 'Medium',
      color: card.severity === 'attention' ? 'Attention' : 'Warning',
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: card.title,
      size: 'Large',
      spacing: 'None',
      wrap: true,
    },
  ];

  if (card.mention) {
    body.push({
      type: 'TextBlock',
      text: `<at>${card.mention.name}</at>`,
      wrap: true,
      spacing: 'Small',
    });
  }

  if (card.facts.length > 0) {
    body.push({ type: 'FactSet', facts: card.facts });
  }

  for (const section of card.sections ?? []) {
    body.push({
      type: 'TextBlock',
      text: section.heading,
      weight: 'Bolder',
      spacing: 'Medium',
      wrap: true,
    });
    for (const line of section.lines) {
      body.push({ type: 'TextBlock', text: line, spacing: 'None', wrap: true });
    }
  }

  const content: Record<string, unknown> = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body,
    actions: card.actions.map((action) => ({
      type: 'Action.OpenUrl',
      title: action.title,
      url: action.url,
    })),
  };

  if (card.mention) {
    content['msteams'] = {
      entities: [
        {
          type: 'mention',
          text: `<at>${card.mention.name}</at>`,
          mentioned: { id: card.mention.upn, name: card.mention.name },
        },
      ],
    };
  }

  return {
    type: 'message',
    attachments: [
      { contentType: 'application/vnd.microsoft.card.adaptive', content },
    ],
  };
}

function backoffFor(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 30_000);
  }
  return attempt * 1500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
