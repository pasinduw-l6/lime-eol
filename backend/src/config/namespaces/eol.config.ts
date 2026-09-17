import { ConfigType, registerAs } from '@nestjs/config';
import { getEnv } from '../env.validation';

export const EOL_CONFIG_KEY = 'eol';

export const eolConfig = registerAs(EOL_CONFIG_KEY, () => {
  const env = getEnv();

  return {
    apiBase: env.EOL_API_BASE,
    syncCron: env.SYNC_CRON,
    syncOnStartup: env.SYNC_ON_STARTUP,
    approachingDays: env.STATUS_APPROACHING_DAYS,
    http: {
      timeoutMs: env.EOL_HTTP_TIMEOUT_MS,
      retryAttempts: env.EOL_RETRY_ATTEMPTS,
      retryBaseDelayMs: env.EOL_RETRY_BASE_DELAY_MS,
      requestDelayMs: env.EOL_REQUEST_DELAY_MS,
      userAgent: env.EOL_USER_AGENT,
    },
  };
});

export type EolConfig = ConfigType<typeof eolConfig>;
