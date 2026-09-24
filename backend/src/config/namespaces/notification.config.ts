import { ConfigType, registerAs } from '@nestjs/config';
import { getEnv } from '../env.validation';

export const NOTIFICATION_CONFIG_KEY = 'notification';

export const notificationConfig = registerAs(NOTIFICATION_CONFIG_KEY, () => {
  const env = getEnv();

  return {
    enabled: env.NOTIFY_ENABLED,
    /// True until someone deliberately turns it off: the safe default for
    /// something that posts into a company channel.
    dryRun: env.NOTIFY_DRY_RUN,
    cron: env.NOTIFY_CRON,
    teamsWebhookUrl: env.TEAMS_WEBHOOK_URL,
    /// Where a card points back to. Deep links carry the technology and cycle
    /// as query params, which opens the plan form already filled in.
    appBaseUrl: env.APP_BASE_URL,
    mailFrom: env.MAIL_FROM,
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  };
});

export type NotificationConfig = ConfigType<typeof notificationConfig>;
