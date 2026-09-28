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
    demo: env.JIRA_DEMO,
    scopedToken: env.JIRA_TOKEN_TYPE === 'scoped',

    missing: (
      [
        ['JIRA_BASE_URL', env.JIRA_BASE_URL],
        ['JIRA_EMAIL', env.JIRA_EMAIL],
        ['JIRA_API_TOKEN', env.JIRA_API_TOKEN],
        ['JIRA_PROJECT_KEY', env.JIRA_PROJECT_KEY],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name),

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
