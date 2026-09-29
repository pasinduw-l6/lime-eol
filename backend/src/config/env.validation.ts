import { z } from 'zod';

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

function blankable<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema,
  );
}

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    TZ: z.string().default('Asia/Colombo'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    APP_BASE_URL: z.string().url().default('http://localhost:4200'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    AUTH_MODE: z
      .enum(['dev', 'entra', 'oidc', 'saml', 'oidc-web'])
      .default('dev'),
    DEV_JWT_SECRET: z.string().optional(),
    ENTRA_TENANT_ID: blankable(z.string().optional()),
    ENTRA_API_CLIENT_ID: blankable(z.string().optional()),
    ENTRA_AUDIENCE: blankable(z.string().optional()),
    OIDC_ISSUER: blankable(z.string().url().optional()),
    OIDC_JWKS_URI: blankable(z.string().url().optional()),
    OIDC_AUDIENCE: blankable(z.string().optional()),

    SAML_ENTRY_POINT: blankable(z.string().url().optional()),
    SAML_IDP_ISSUER: blankable(z.string().optional()),
    SAML_CERT: blankable(z.string().optional()),
    SAML_SP_ENTITY_ID: blankable(z.string().optional()),
    SAML_CALLBACK_URL: blankable(z.string().url().optional()),

    OIDC_WEB_TENANT_ID: blankable(z.string().optional()),
    OIDC_WEB_CLIENT_ID: blankable(z.string().optional()),
    OIDC_WEB_CLIENT_SECRET: blankable(z.string().optional()),
    OIDC_WEB_REDIRECT_URI: blankable(z.string().url().optional()),

    // Signs the session tokens this API issues once an identity provider has
    // vouched for someone. Shared by every mode that does its own sign-in, so
    // it is not named after any one of them - and unlike DEV_JWT_SECRET it is
    // allowed in production.
    SESSION_SECRET: blankable(z.string().optional()),

    EOL_API_BASE: z.string().url().default('https://endoflife.date/api/v1'),
    SYNC_CRON: z.string().default('0 2 * * *'),
    SYNC_ON_STARTUP: booleanish.default(false),
    STATUS_APPROACHING_DAYS: z.coerce.number().int().positive().default(180),
    EOL_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    EOL_RETRY_ATTEMPTS: z.coerce.number().int().min(0).max(10).default(3),
    EOL_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(1000),
    EOL_REQUEST_DELAY_MS: z.coerce.number().int().min(0).default(1000),
    EOL_USER_AGENT: z.string().default('lime-eol-registry/0.1 (+internal)'),

    NOTIFY_CRON: z.string().default('0 8 * * *'),
    NOTIFY_ENABLED: booleanish.default(false),
    NOTIFY_DRY_RUN: booleanish.default(true),
    TEAMS_WEBHOOK_URL: blankable(z.string().url().optional()),
    SMTP_HOST: blankable(z.string().optional()),
    SMTP_PORT: blankable(z.coerce.number().int().positive().optional()),
    SMTP_USER: blankable(z.string().optional()),
    SMTP_PASS: blankable(z.string().optional()),
    MAIL_FROM: blankable(z.string().optional()),

    JIRA_BASE_URL: blankable(z.string().url().optional()),
    JIRA_EMAIL: blankable(z.string().email().optional()),
    JIRA_API_TOKEN: blankable(z.string().optional()),
    JIRA_PROJECT_KEY: blankable(z.string().optional()),
    JIRA_TOKEN_TYPE: z.enum(['scoped', 'classic']).default('scoped'),
    JIRA_SYNC_CRON: z.string().default('*/15 * * * *'),
    JIRA_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    JIRA_DEMO: booleanish.default(false),
  })
  .refine(
    (env) => !(env.NODE_ENV === 'production' && env.JIRA_DEMO),
    'JIRA_DEMO=true is not allowed when NODE_ENV=production',
  )
  .refine((env) => {
    const parts = [
      env.JIRA_BASE_URL,
      env.JIRA_EMAIL,
      env.JIRA_API_TOKEN,
      env.JIRA_PROJECT_KEY,
    ].filter(Boolean).length;
    return parts === 0 || parts === 4;
  }, 'JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN and JIRA_PROJECT_KEY must be set together, or all left unset')
  .refine(
    (env) => !env.NOTIFY_ENABLED || env.NOTIFY_DRY_RUN || !!env.TEAMS_WEBHOOK_URL,
    'TEAMS_WEBHOOK_URL is required when NOTIFY_ENABLED=true and NOTIFY_DRY_RUN=false',
  )
  .refine(
    (env) => !(env.NODE_ENV === 'production' && env.AUTH_MODE === 'dev'),
    'AUTH_MODE=dev is not allowed when NODE_ENV=production',
  )
  .refine(
    (env) => env.AUTH_MODE !== 'dev' || !!env.DEV_JWT_SECRET,
    'DEV_JWT_SECRET is required when AUTH_MODE=dev',
  )
  .refine(
    (env) =>
      env.AUTH_MODE !== 'entra' ||
      (!!env.ENTRA_TENANT_ID && !!env.ENTRA_AUDIENCE),
    'ENTRA_TENANT_ID and ENTRA_AUDIENCE are required when AUTH_MODE=entra',
  )
  .refine(
    (env) =>
      env.AUTH_MODE !== 'oidc' ||
      (!!env.OIDC_ISSUER && !!env.OIDC_JWKS_URI && !!env.OIDC_AUDIENCE),
    'OIDC_ISSUER, OIDC_JWKS_URI and OIDC_AUDIENCE are required when AUTH_MODE=oidc',
  )
  .refine(
    (env) =>
      env.AUTH_MODE !== 'saml' ||
      (!!env.SAML_ENTRY_POINT &&
        !!env.SAML_CERT &&
        !!env.SAML_SP_ENTITY_ID &&
        !!env.SESSION_SECRET),
    'SAML_ENTRY_POINT, SAML_CERT, SAML_SP_ENTITY_ID and SESSION_SECRET are required when AUTH_MODE=saml',
  )
  .refine(
    (env) =>
      env.AUTH_MODE !== 'oidc-web' ||
      (!!env.OIDC_WEB_TENANT_ID &&
        !!env.OIDC_WEB_CLIENT_ID &&
        !!env.OIDC_WEB_CLIENT_SECRET &&
        !!env.SESSION_SECRET),
    'OIDC_WEB_TENANT_ID, OIDC_WEB_CLIENT_ID, OIDC_WEB_CLIENT_SECRET and SESSION_SECRET are required when AUTH_MODE=oidc-web',
  );

export type AppEnv = z.infer<typeof envSchema>;

let validated: AppEnv | undefined;

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  validated = parsed.data;
  return validated;
}

export function getEnv(): AppEnv {
  return validated ?? validateEnv(process.env);
}
