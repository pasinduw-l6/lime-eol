import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getEnv } from '../../config/env.validation';

/**
 * Reads repositories as the GitHub App: a short JWT signed with the app's private key buys a
 * one-hour installation token for the organisation, renewed a few minutes before it runs out.
 */
export class GitHubApp {
  private token: { value: string; expires: number } | null = null;
  private installationId: number | null = null;

  static fromEnv(): GitHubApp | null {
    const env = getEnv();
    if (!env.GITHUB_APP_ID) return null;
    const key = env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? readKey(env.GITHUB_APP_PRIVATE_KEY_PATH);
    return key ? new GitHubApp(env.GITHUB_APP_ID, env.GITHUB_APP_ORG, key) : null;
  }

  private constructor(
    readonly appId: string,
    readonly org: string,
    private readonly key: string,
  ) {}

  async app(): Promise<{ name: string; repositorySelection: string | null }> {
    const app = (await this.call('/app', this.jwt())) as { name: string };
    const installation = await this.installation();
    return { name: app.name, repositorySelection: installation.repository_selection ?? null };
  }

  async repos(): Promise<{ fullName: string; name: string; defaultBranch: string }[]> {
    const all: { full_name: string; name: string; default_branch: string }[] = [];
    for (let page = 1; page <= 20; page++) {
      const data = (await this.get(`/installation/repositories?per_page=100&page=${page}`)) as {
        total_count: number;
        repositories: { full_name: string; name: string; default_branch: string }[];
      };
      all.push(...data.repositories);
      if (all.length >= data.total_count || data.repositories.length === 0) break;
    }
    return all
      .map((r) => ({ fullName: r.full_name, name: r.name, defaultBranch: r.default_branch }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Every branch, main ones first: repos here can have hundreds of feature branches. */
  async branches(repo: string): Promise<string[]> {
    const names: string[] = [];
    for (let page = 1; page <= 30; page++) {
      const data = (await this.get(`/repos/${repo}/branches?per_page=100&page=${page}`)) as { name: string }[];
      names.push(...data.map((b) => b.name));
      if (data.length < 100) break;
    }
    const main = ['master', 'main', 'development', 'develop', 'dev', 'uat', 'staging', 'release'];
    return names.sort((a, b) => {
      const ia = main.indexOf(a.toLowerCase());
      const ib = main.indexOf(b.toLowerCase());
      if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a.localeCompare(b);
    });
  }

  async commit(repo: string, branch: string) {
    const c = (await this.get(`/repos/${repo}/commits/${encodeURIComponent(branch)}`)) as {
      sha: string;
      html_url: string;
      author: { login: string } | null;
      commit: { message: string; author: { name: string; date: string } | null; committer: { date: string } | null };
    };
    return {
      sha: c.sha,
      url: c.html_url,
      message: c.commit.message.split('\n')[0].slice(0, 200),
      author: c.author?.login ?? c.commit.author?.name ?? 'unknown',
      at: c.commit.committer?.date ?? c.commit.author?.date ?? new Date().toISOString(),
    };
  }

  /** A file's text at a commit, or null when it is not there. */
  async file(repo: string, path: string, ref: string): Promise<string | null> {
    try {
      const data = (await this.get(`/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`)) as
        | { content?: string; encoding?: string }
        | unknown[];
      if (Array.isArray(data) || !data.content) return null;
      return Buffer.from(data.content, 'base64').toString('utf8');
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }
  }

  private async get(path: string): Promise<unknown> {
    return this.call(path, await this.installationToken());
  }

  private async installation(): Promise<{ id: number; repository_selection?: string }> {
    const list = (await this.call('/app/installations', this.jwt())) as {
      id: number;
      account: { login: string };
      repository_selection?: string;
    }[];
    const found = list.find((i) => i.account.login.toLowerCase() === this.org.toLowerCase());
    if (!found) throw new GitHubError(`The GitHub App is not installed on ${this.org}.`);
    this.installationId = found.id;
    return found;
  }

  private async installationToken(): Promise<string> {
    if (this.token && this.token.expires - Date.now() > 5 * 60_000) return this.token.value;
    const id = this.installationId ?? (await this.installation()).id;
    const data = (await this.call(`/app/installations/${id}/access_tokens`, this.jwt(), 'POST')) as {
      token: string;
      expires_at: string;
    };
    this.token = { value: data.token, expires: Date.parse(data.expires_at) };
    return data.token;
  }

  private jwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const part = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const body = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iat: now - 60, exp: now + 540, iss: this.appId })}`;
    return `${body}.${createSign('RSA-SHA256').update(body).sign(this.key, 'base64url')}`;
  }

  private async call(path: string, token: string, method = 'GET'): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`https://api.github.com${path}`, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'lime-eol',
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new GitHubError('GitHub could not be reached.');
    }
    if (response.status === 401) throw new GitHubError('GitHub refused the app key. Check GITHUB_APP_ID and the private key.', 401);
    if (!response.ok) throw new GitHubError(`GitHub answered ${response.status} for ${path.split('?')[0]}.`, response.status);
    return response.json();
  }
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function readKey(path: string | undefined): string | null {
  if (!path) return null;
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}
