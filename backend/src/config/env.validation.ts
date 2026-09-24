import { z } from 'zod';

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

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
    TEAMS_WEBHOOK_URL: z.string().url().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().optional(),
  })
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
