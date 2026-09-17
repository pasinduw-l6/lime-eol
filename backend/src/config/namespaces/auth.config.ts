import { ConfigType, registerAs } from '@nestjs/config';
import { getEnv } from '../env.validation';

export const AUTH_CONFIG_KEY = 'auth';

export const authConfig = registerAs(AUTH_CONFIG_KEY, () => {
  const env = getEnv();

  return {
    mode: env.AUTH_MODE,
    devJwtSecret: env.DEV_JWT_SECRET,
    entra: {
      tenantId: env.ENTRA_TENANT_ID,
      clientId: env.ENTRA_API_CLIENT_ID,
      audience: env.ENTRA_AUDIENCE,
      issuer: env.ENTRA_TENANT_ID
        ? `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`
        : undefined,
      jwksUri: env.ENTRA_TENANT_ID
        ? `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/discovery/v2.0/keys`
        : undefined,
    },
  };
});

export type AuthConfig = ConfigType<typeof authConfig>;
