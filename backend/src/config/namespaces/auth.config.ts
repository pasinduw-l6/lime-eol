import { ConfigType, registerAs } from '@nestjs/config';
import { getEnv } from '../env.validation';

export const AUTH_CONFIG_KEY = 'auth';

export const authConfig = registerAs(AUTH_CONFIG_KEY, () => {
  const env = getEnv();

  return {
    sessionSecret: env.SESSION_SECRET,
    oidcWeb: resolveOidcWeb(env),
  };
});

function resolveOidcWeb(env: ReturnType<typeof getEnv>) {
  const tenant = env.OIDC_WEB_TENANT_ID;
  const base = `https://login.microsoftonline.com/${tenant}`;

  return {
    tenantId: tenant,
    clientId: env.OIDC_WEB_CLIENT_ID,
    clientSecret: env.OIDC_WEB_CLIENT_SECRET,
    authorizeUrl: `${base}/oauth2/v2.0/authorize`,
    tokenUrl: `${base}/oauth2/v2.0/token`,
    jwksUri: `${base}/discovery/v2.0/keys`,
    issuer: `${base}/v2.0`,
    redirectUri:
      env.OIDC_WEB_REDIRECT_URI ??
      `${env.APP_BASE_URL.replace(/\/$/, '')}/api/v1/auth/oidc/callback`,
  };
}

export type AuthConfig = ConfigType<typeof authConfig>;
