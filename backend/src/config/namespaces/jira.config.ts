import { ConfigType, registerAs } from '@nestjs/config';
import { getEnv } from '../env.validation';

export const JIRA_CONFIG_KEY = 'jira';

export const jiraConfig = registerAs(JIRA_CONFIG_KEY, () => {
  const env = getEnv();

  return {
    baseUrl: env.JIRA_BASE_URL?.replace(/\/+$/, ''),
    email: env.JIRA_EMAIL,
    apiToken: env.JIRA_API_TOKEN,
    projectKey: env.JIRA_PROJECT_KEY,
    cron: env.JIRA_SYNC_CRON,
    timeoutMs: env.JIRA_HTTP_TIMEOUT_MS,

    /// The env schema enforces all-four-or-none, so one check answers whether
    /// the real adapter can do anything at all.
    get configured(): boolean {
      return Boolean(
        env.JIRA_BASE_URL &&
          env.JIRA_EMAIL &&
          env.JIRA_API_TOKEN &&
          env.JIRA_PROJECT_KEY,
      );
    },
  };
});

export type JiraConfig = ConfigType<typeof jiraConfig>;
