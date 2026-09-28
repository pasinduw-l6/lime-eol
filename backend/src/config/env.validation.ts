import { z } from 'zod';

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

/**
 * Treats a blank value as absent.
 *
 * A key left empty in an .env template arrives as '', not undefined, so
 * `.optional()` alone does not cover it and the underlying check runs against
 * the empty string — which is how `JIRA_BASE_URL=` became "Invalid URL" rather
 * than "not configured". Anything a person is expected to leave blank until
 * they have a value for it goes through here.
 */
function blankable<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema,
  );
}

export const envSchema = z
  .object({
    // ---- General ----
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    TZ: z.string().default('Asia/Colombo'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    APP_BASE_URL: z.string().url().default('http://localhost:4200'),

    // ---- Database ----
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // ---- Auth ----
    AUTH_MODE: z.enum(['dev', 'entra']).default('dev'),
    DEV_JWT_SECRET: z.string().optional(),
    ENTRA_TENANT_ID: z.string().optional(),
    ENTRA_API_CLIENT_ID: z.string().optional(),
    ENTRA_AUDIENCE: z.string().optional(),

    // ---- EOL sync ----
    EOL_API_BASE: z.string().url().default('https://endoflife.date/api/v1'),
    SYNC_CRON: z.string().default('0 2 * * *'),
    SYNC_ON_STARTUP: booleanish.default(false),
    STATUS_APPROACHING_DAYS: z.coerce.number().int().positive().default(180),
    // Client tuning for PLAN section 10.2 (timeout, retries, polite pacing).
    EOL_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    EOL_RETRY_ATTEMPTS: z.coerce.number().int().min(0).max(10).default(3),
    EOL_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(1000),
    EOL_REQUEST_DELAY_MS: z.coerce.number().int().min(0).default(1000),
    EOL_USER_AGENT: z.string().default('lime-eol-registry/0.1 (+internal)'),

    // ---- Notifications ----
    NOTIFY_CRON: z.string().default('0 8 * * *'),
    NOTIFY_ENABLED: booleanish.default(false),
    /// Renders and records what would be sent, without making the request.
    NOTIFY_DRY_RUN: booleanish.default(true),
    /// Power Automate trigger URL. Carries a sig= credential.
    TEAMS_WEBHOOK_URL: blankable(z.string().url().optional()),
    SMTP_HOST: blankable(z.string().optional()),
    SMTP_PORT: blankable(z.coerce.number().int().positive().optional()),
    SMTP_USER: blankable(z.string().optional()),
    SMTP_PASS: blankable(z.string().optional()),
    MAIL_FROM: blankable(z.string().optional()),

    // ---- Jira ----
    // All four are optional: with none of them set the app runs against a null
    // adapter, reports "not connected" and stays fully usable. The registry
    // must never depend on Jira being reachable.
    /// e.g. https://linearsix.atlassian.net — no trailing path.
    JIRA_BASE_URL: blankable(z.string().url().optional()),
    /// The account the API token belongs to. Cloud Basic auth is email:token.
    JIRA_EMAIL: blankable(z.string().email().optional()),
    /// Carries full access as that user. Treated like TEAMS_WEBHOOK_URL: env
    /// only, never committed, never logged, never returned by an endpoint.
    JIRA_API_TOKEN: blankable(z.string().optional()),
    /// Where upgrade epics are created, e.g. KAN.
    JIRA_PROJECT_KEY: blankable(z.string().optional()),
    /// Scoped tokens are restricted to chosen scopes and must be sent through
    /// Atlassian's gateway; classic tokens carry full account access and go to
    /// the site URL. The two are indistinguishable as strings, so which one it
    /// is has to be stated rather than detected. Classic tokens are being
    /// phased out, so scoped is the default.
    JIRA_TOKEN_TYPE: z.enum(['scoped', 'classic']).default('scoped'),
    /// How often the worker reconciles linked issues. Jira is a cache here.
    JIRA_SYNC_CRON: z.string().default('*/15 * * * *'),
    JIRA_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    /// Serves invented issues so the integration can be shown without access
    /// to a real Jira. Never a fallback for missing credentials: it has to be
    /// turned on deliberately, and the panel says so on screen.
    JIRA_DEMO: booleanish.default(false),
  })
  // Invented issues must never reach a real deployment. The same rule
  // AUTH_MODE=dev follows.
  .refine(
    (env) => !(env.NODE_ENV === 'production' && env.JIRA_DEMO),
    'JIRA_DEMO=true is not allowed when NODE_ENV=production',
  )
  // Partial credentials are worse than none: the app would look connected and
  // fail on every call. Either all four, or none.
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
  // The app must refuse to start with AUTH_MODE=dev in production (PLAN section 5).
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

/**
 * The validated, coerced environment. Config namespaces read from here rather
 * than from process.env, so nothing bypasses the schema.
 */
export function getEnv(): AppEnv {
  return validated ?? validateEnv(process.env);
}
