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

    /**
     * The provider, reduced to the three things a token check needs.
     *
     * Entra fills these from the tenant id because its URLs are predictable;
     * anything else states them outright. The strategy reads only this, so it
     * never learns which provider it is talking to.
     */
    oidc: resolveProvider(env),
  };
});

function resolveProvider(env: ReturnType<typeof getEnv>) {
  if (env.AUTH_MODE === 'entra' && env.ENTRA_TENANT_ID && env.ENTRA_AUDIENCE) {
    return {
      issuer: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`,
      jwksUri: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
      audience: env.ENTRA_AUDIENCE,
    };
  }

  if (
    env.AUTH_MODE === 'oidc' &&
    env.OIDC_ISSUER &&
    env.OIDC_JWKS_URI &&
    env.OIDC_AUDIENCE
  ) {
    return {
      issuer: env.OIDC_ISSUER,
      jwksUri: env.OIDC_JWKS_URI,
      audience: env.OIDC_AUDIENCE,
    };
  }

  return undefined;
}

export type AuthConfig = ConfigType<typeof authConfig>;
