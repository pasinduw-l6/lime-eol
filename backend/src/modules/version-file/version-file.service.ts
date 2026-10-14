import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getEnv } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { DeploymentsService } from '../deployments/deployments.service';
import { parseVersionFile, registryName } from './version-file.parser';

interface Commit {
  sha: string;
  url: string;
  message: string;
  author: string;
  at: string;
}

export interface SyncResult {
  status: 'OK' | 'WARN' | 'ERROR' | 'UNCHANGED';
  message: string;
  applied: string[];
  warnings: string[];
}

const STATE_ID = 'default';
/** How many commits to the file are looked at per sync. Older unseen commits are skipped. */
const PAGE = 30;

@Injectable()
export class VersionFileService {
  private readonly logger = new Logger(VersionFileService.name);
  private running: Promise<SyncResult> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly deployments: DeploymentsService,
  ) {}

  source() {
    const env = getEnv();
    return {
      repo: env.VERSIONS_REPO,
      file: env.VERSIONS_FILE,
      branch: env.VERSIONS_BRANCH,
      token: !!env.GITHUB_TOKEN,
      url: `https://github.com/${env.VERSIONS_REPO}/blob/${env.VERSIONS_BRANCH}/${env.VERSIONS_FILE}`,
    };
  }

  async status() {
    const state = await this.prisma.versionSync.findUnique({ where: { id: STATE_ID } });
    return {
      ...this.source(),
      status: state?.status ?? 'NEVER',
      message: state?.message ?? null,
      warnings: (state?.warnings as string[] | undefined) ?? [],
      managed: ((state?.managed as string[] | undefined) ?? []).length,
      lastCheckedAt: state?.lastCheckedAt?.toISOString() ?? null,
      lastAppliedAt: state?.lastAppliedAt?.toISOString() ?? null,
      lastCommit: state?.lastCommitSha
        ? {
            sha: state.lastCommitSha,
            message: state.lastCommitMessage,
            author: state.lastCommitAuthor,
            url: state.lastCommitUrl,
            at: state.lastCommitAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  /** Reads the newest commits to the file and applies each one, oldest first. Runs one at a time. */
  sync(): Promise<SyncResult> {
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  private async run(): Promise<SyncResult> {
    const state = await this.prisma.versionSync.findUnique({ where: { id: STATE_ID } });
    const checkedAt = new Date();

    let commits: Commit[];
    try {
      commits = await this.commits();
    } catch (error) {
      return this.fail(error, checkedAt);
    }

    if (commits.length === 0) {
      const { file, branch } = this.source();
      return this.save(checkedAt, { status: 'ERROR', message: `${file} was not found on ${branch}. Add it to the repository.`, applied: [], warnings: [] });
    }

    const seen = state?.lastCommitSha ? commits.findIndex((c) => c.sha === state.lastCommitSha) : -1;
    if (seen === 0) {
      await this.prisma.versionSync.update({ where: { id: STATE_ID }, data: { lastCheckedAt: checkedAt } });
      return { status: 'UNCHANGED', message: 'No new commits to the file.', applied: [], warnings: (state?.warnings as string[]) ?? [] };
    }

    // First sync, or the last commit we saw has scrolled out of the page: only the newest file counts.
    const pending = (seen > 0 ? commits.slice(0, seen) : commits.slice(0, 1)).reverse();
    const applied: string[] = [];
    let warnings: string[] = [];
    let managed: string[] = [];

    try {
      for (const commit of pending) {
        const text = await this.content(commit.sha);
        const result = await this.apply(text, commit);
        applied.push(...result.applied);
        warnings = result.warnings;
        managed = result.managed;
      }
    } catch (error) {
      return this.fail(error, checkedAt);
    }

    const newest = pending[pending.length - 1];
    const seenCommit = {
      lastCommitSha: newest.sha,
      lastCommitAt: new Date(newest.at),
      lastCommitMessage: newest.message,
      lastCommitAuthor: newest.author,
      lastCommitUrl: newest.url,
      lastAppliedAt: checkedAt,
      managed: managed as Prisma.InputJsonValue,
    };
    await this.prisma.versionSync.upsert({
      where: { id: STATE_ID },
      create: { id: STATE_ID, ...seenCommit },
      update: seenCommit,
    });

    const message = applied.length
      ? `${applied.length} version change${applied.length === 1 ? '' : 's'} recorded from ${pending.length} commit${pending.length === 1 ? '' : 's'}.`
      : 'The file matches what the tool already records.';
    this.logger.log(message);
    return this.save(checkedAt, { status: warnings.length ? 'WARN' : 'OK', message, applied, warnings });
  }

  private async apply(text: string, commit: Commit) {
    const parsed = parseVersionFile(text);
    const warnings = [...parsed.warnings];
    const applied: string[] = [];
    const managed: string[] = [];

    const [projects, technologies] = await Promise.all([
      this.prisma.project.findMany({
        where: { archivedAt: null },
        include: { deployments: { where: { archivedAt: null } } },
      }),
      this.prisma.technology.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
    ]);
    const names = technologies.map((t) => t.name);

    for (const entry of parsed.entries) {
      const where = `${entry.project} · ${entry.environment} · ${entry.technology}`;
      const project = projects.find((p) => p.code.toLowerCase() === entry.project.toLowerCase());
      if (!project) {
        warnings.push(`${where}: no project with code ${entry.project}.`);
        continue;
      }
      const deployment = project.deployments.find((d) => d.environment === entry.environment);
      if (!deployment) {
        warnings.push(`${where}: ${project.name} has no ${entry.environment} environment.`);
        continue;
      }
      const name = registryName(entry.technology, names);
      const technology = technologies.find((t) => t.name === name);
      if (!technology) {
        warnings.push(`${where}: ${entry.technology} is not in the registry. Add it under Lifecycle → Registry.`);
        continue;
      }

      managed.push(`${deployment.id}|${technology.id}`);
      const current = await this.currentVersion(deployment.id, technology.id);
      if (current === entry.version) continue;

      try {
        await this.deployments.changeComponent(
          deployment.id,
          {
            technology: technology.name,
            toVersion: entry.version,
            effectiveAt: commit.at.slice(0, 10),
            note: note(commit),
            evidenceUrl: commit.url,
          },
          undefined,
          { fromVersionFile: true },
        );
        applied.push(`${project.code} · ${entry.environment} · ${technology.name} ${current ?? 'none'} → ${entry.version}`);
      } catch (error) {
        warnings.push(`${where}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { applied, warnings, managed: [...new Set(managed)] };
  }

  private async currentVersion(deploymentId: string, technologyId: string): Promise<string | null> {
    const row = await this.prisma.deploymentComponent.findFirst({
      where: { deploymentId, techVersion: { cycle: { technologyId } } },
      include: { techVersion: true },
    });
    return row?.techVersion.fullVersion ?? null;
  }

  private async commits(): Promise<Commit[]> {
    const { repo, file, branch } = this.source();
    const query = new URLSearchParams({ path: file, sha: branch, per_page: String(PAGE) });
    const list = (await this.github(`/repos/${repo}/commits?${query}`, 'application/vnd.github+json')) as GitHubCommit[];
    return list.map((c) => ({
      sha: c.sha,
      url: c.html_url,
      message: c.commit.message.split('\n')[0].slice(0, 200),
      author: c.author?.login ?? c.commit.author?.name ?? 'unknown',
      at: c.commit.committer?.date ?? c.commit.author?.date ?? new Date().toISOString(),
    }));
  }

  private async content(sha: string): Promise<string> {
    const { repo, file } = this.source();
    return (await this.github(`/repos/${repo}/contents/${encodeURI(file)}?ref=${sha}`, 'application/vnd.github.raw+json', true)) as string;
  }

  private async github(path: string, accept: string, raw = false): Promise<unknown> {
    const token = getEnv().GITHUB_TOKEN;
    let response: Response;
    try {
      response = await fetch(`https://api.github.com${path}`, {
        headers: {
          Accept: accept,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'lime-eol',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new SyncError('GitHub could not be reached.');
    }
    if (response.status === 401) throw new SyncError('The GitHub token was refused. It may have expired; create a new one.');
    if (response.status === 403 || response.status === 429) {
      throw new SyncError(token ? 'GitHub refused the request (rate limit or missing permission).' : 'GitHub rate limit reached. Add GITHUB_TOKEN to raise it.');
    }
    if (response.status === 404) {
      const { repo } = this.source();
      throw new SyncError(token ? `${repo} or the branch was not found, or the token cannot read it.` : `${repo} was not found. If it is private, add GITHUB_TOKEN.`);
    }
    if (!response.ok) throw new SyncError(`GitHub answered ${response.status}.`);
    return raw ? response.text() : response.json();
  }

  private async fail(error: unknown, checkedAt: Date): Promise<SyncResult> {
    const message = error instanceof SyncError ? error.message : 'The sync failed. See the worker log.';
    if (!(error instanceof SyncError)) this.logger.error(error);
    return this.save(checkedAt, { status: 'ERROR', message, applied: [], warnings: [] });
  }

  private async save(checkedAt: Date, result: SyncResult): Promise<SyncResult> {
    const data = {
      lastCheckedAt: checkedAt,
      status: result.status,
      message: result.message,
      ...(result.status === 'ERROR' ? {} : { warnings: result.warnings as Prisma.InputJsonValue }),
    };
    await this.prisma.versionSync.upsert({ where: { id: STATE_ID }, create: { id: STATE_ID, ...data }, update: data });
    return result;
  }
}

class SyncError extends Error {}

function note(commit: Commit): string {
  return `From eol-versions.yml · ${commit.sha.slice(0, 7)} "${commit.message}" by ${commit.author}`.slice(0, 500);
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  author: { login: string } | null;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
    committer: { date: string } | null;
  };
}
