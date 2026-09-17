import { ConfigType, registerAs } from '@nestjs/config';
import { getEnv } from '../env.validation';

export const APP_CONFIG_KEY = 'app';

export const appConfig = registerAs(APP_CONFIG_KEY, () => {
  const env = getEnv();

  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    timezone: env.TZ,
    port: env.API_PORT,
    baseUrl: env.APP_BASE_URL,
  };
});

export type AppConfig = ConfigType<typeof appConfig>;
