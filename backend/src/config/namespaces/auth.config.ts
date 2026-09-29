import { ConfigType, registerAs } from '@nestjs/config';
import { getEnv } from '../env.validation';

export const AUTH_CONFIG_KEY = 'auth';

export const authConfig = registerAs(AUTH_CONFIG_KEY, () => {
  const env = getEnv();

  return {
    mode: env.AUTH_MODE,
    devJwtSecret: env.DEV_JWT_SECRET,

    // The secret this API signs its OWN session tokens with. In saml and
    // oidc-web the identity provider proves who you are once, then the app
    // issues the same bearer token it has always issued - so the signing key
    // has to come from somewhere other than DEV_JWT_SECRET, which is refused
    // in production.
    sessionSecret: env.SESSION_SECRET ?? env.DEV_JWT_SECRET,

    saml: resolveSaml(env),
    oidcWeb: resolveOidcWeb(env),

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

    oidc: resolveProvider(env),
  };
});

/**
 * Microsoft sign-in through the authorization code flow, against an app
 * registration rather than an enterprise application.
 *
 * Everything except the tenant id, client id and secret is derived: the v2.0
 * endpoints all follow from the tenant, and the redirect must match what is
 * registered in Entra, which is this API's own callback under APP_BASE_URL.
 */
function resolveOidcWeb(env: ReturnType<typeof getEnv>) {
  if (
    env.AUTH_MODE !== 'oidc-web' ||
    !env.OIDC_WEB_TENANT_ID ||
    !env.OIDC_WEB_CLIENT_ID ||
    !env.OIDC_WEB_CLIENT_SECRET
  ) {
    return undefined;
  }

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

/**
 * The Entra values are copied by hand out of the enterprise application's
 * "Set up single sign-on with SAML" pane, so the names here mirror the labels
 * shown there rather than the SAML specification's own vocabulary.
 */
function resolveSaml(env: ReturnType<typeof getEnv>) {
  if (
    env.AUTH_MODE !== 'saml' ||
    !env.SAML_ENTRY_POINT ||
    !env.SAML_CERT ||
    !env.SAML_SP_ENTITY_ID
  ) {
    return undefined;
  }

  return {
    // Entra's "Login URL".
    entryPoint: env.SAML_ENTRY_POINT,
    // Entra's "Microsoft Entra Identifier". Left unset the assertion's issuer
    // is not checked, so it is worth setting even though it is optional.
    idpIssuer: env.SAML_IDP_ISSUER,
    // The "Certificate (Base64)" download, as one line or with its PEM header.
    idpCert: normaliseCert(env.SAML_CERT),
    // Our "Identifier (Entity ID)" - what we call ourselves to Entra.
    spEntityId: env.SAML_SP_ENTITY_ID,
    // Where Entra POSTs the assertion: Entra's "Reply URL". Defaults to this
    // API's own route under APP_BASE_URL, which is right in every normal case.
    callbackUrl:
      env.SAML_CALLBACK_URL ??
      `${env.APP_BASE_URL.replace(/\/$/, '')}/api/v1/auth/saml/acs`,
  };
}

/**
 * Accepts the certificate either as the raw base64 blob Entra hands you or as
 * a full PEM block, and tolerates the `\n` escapes that survive a trip through
 * a .env file. Without this the signature check fails with an error that says
 * nothing about the real cause.
 */
function normaliseCert(raw: string): string {
  const body = raw
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');

  return body;
}

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
