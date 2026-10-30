import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectSource } from '@prisma/client';
import { getEnv } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { DeploymentsService } from '../deployments/deployments.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { TeamsAdapter } from '../notifications/adapters/teams.adapter';
import { NotificationCard } from '../notifications/ports/notification-channel.port';
import { GitHubApp, GitHubError } from './github-app.client';
import { angularFromPackage, nodeFromDockerfile } from './version-parsers';

export interface SaveSourceInput {
  repo: string;
  prodBranch: string;
  devBranch?: string | null;
  dockerfilePath?: string | null;
  packagePath?: string | null;
}

export interface Found {
  branch: string;
  sha: string;
  url: string;
  at: string;
  dockerfile: string | null;
  packageJson: string | null;
  node: string | null;
  angular: string | null;
}

const DOCKERFILES = ['Dockerfile', 'gui/Dockerfile'];
const PACKAGES = ['gui/package.json', 'package.json'];

@Injectable()
export class SourceCodeService {
  private readonly logger = new Logger(SourceCodeService.name);
  private readonly github = GitHubApp.fromEnv();
  private repoCache: { at: number; list: Awaited<ReturnType<GitHubApp['repos']>> } | null = null;
  private running: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly deployments: DeploymentsService,
    private readonly teams: TeamsAdapter,
    private readonly integrations: IntegrationsService,
  ) {}

  async status() {
    const env = getEnv();
    const sources = await this.prisma.projectSource.findMany({ include: { project: { select: { name: true, code: true } } } });
    const base = {
      configured: !!this.github,
      appId: env.GITHUB_APP_ID ?? null,
      org: env.GITHUB_APP_ORG,
      sources: sources.map(toDto),
    };
    if (!this.github) return { ...base, appName: null, repositorySelection: null, repoCount: null, error: null };
    try {
      const [app, repos] = await Promise.all([this.github.app(), this.repos()]);
      return { ...base, appName: app.name, repositorySelection: app.repositorySelection, repoCount: repos.length, error: null };
    } catch (error) {
      return { ...base, appName: null, repositorySelection: null, repoCount: null, error: message(error) };
    }
  }

  async repos() {
    const github = this.need();
    if (this.repoCache && Date.now() - this.repoCache.at < 5 * 60_000) return this.repoCache.list;
    const list = await github.repos();
    this.repoCache = { at: Date.now(), list };
    return list;
  }

  async branches(repo: string): Promise<string[]> {
    return this.need().branches(repo);
  }

  async save(projectId: string, input: SaveSourceInput) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, archivedAt: null } });
    if (!project) throw new NotFoundException(`No project "${projectId}"`);
    const repo = input.repo.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new BadRequestException('Pick a repository.');
    if (!input.prodBranch?.trim()) throw new BadRequestException('Pick the production branch.');

    const data = {
      repo,
      prodBranch: input.prodBranch.trim(),
      devBranch: input.devBranch?.trim() || null,
      dockerfilePath: input.dockerfilePath?.trim() || null,
      packagePath: input.packagePath?.trim() || null,
      // A new repo or branch is read again from scratch.
      found: {} as Prisma.InputJsonValue,
      status: 'NEVER',
      message: null,
    };
    await this.prisma.projectSource.upsert({ where: { projectId }, create: { projectId, ...data }, update: data });
    await this.scanProject(projectId);
    return toDto(await this.prisma.projectSource.findUniqueOrThrow({ where: { projectId } }));
  }

  /** Stops reading GitHub for a project. Its recorded versions stay and can be edited by hand again. */
  async remove(projectId: string): Promise<void> {
    await this.prisma.projectSource.deleteMany({ where: { projectId } });
  }

  /** Reads every project's branches. Runs one at a time; a second call waits for the first. */
  scanAll(): Promise<void> {
    this.running ??= this.runAll().finally(() => (this.running = null));
    return this.running;
  }

  private async runAll(): Promise<void> {
    if (!this.github) return;
    const sources = await this.prisma.projectSource.findMany({ select: { projectId: true } });
    for (const s of sources) await this.scanProject(s.projectId);
    await this.sendDueReminders();
  }

  async scanProject(projectId: string): Promise<void> {
    const github = this.github;
    const source = await this.prisma.projectSource.findUnique({ where: { projectId } });
    if (!github || !source) return;

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { deployments: { where: { archivedAt: null } } },
    });
    const technologies = await this.prisma.technology.findMany({
      where: { name: { in: ['Node.js', 'Angular'] }, archivedAt: null },
      select: { id: true, name: true },
    });

    const before = (source.found ?? {}) as unknown as Record<string, Found>;
    const found: Record<string, Found> = { ...before };
    const managed = new Set<string>();
    const warnings: string[] = [];
    let changes = 0;
    let proposals = 0;

    const lanes = [
      { environment: 'PROD', branch: source.prodBranch },
      ...(source.devBranch ? [{ environment: 'DEV', branch: source.devBranch }] : []),
    ];

    try {
      for (const lane of lanes) {
        const deployment = project.deployments.find((d) => d.environment === lane.environment);
        const commit = await github.commit(source.repo, lane.branch);

        let result = before[lane.environment];
        // The first read of a branch is the starting point and is recorded straight away; later changes wait for approval.
        const firstRead = !result || result.branch !== lane.branch;
        if (!result || result.sha !== commit.sha || result.branch !== lane.branch) {
          const dockerfile = await firstFile(github, source.repo, commit.sha, source.dockerfilePath ? [source.dockerfilePath] : DOCKERFILES);
          const pkg = await firstFile(github, source.repo, commit.sha, source.packagePath ? [source.packagePath] : PACKAGES);
          const lock = pkg ? await github.file(source.repo, pkg.path.replace(/package\.json$/, 'package-lock.json'), commit.sha) : null;
          result = {
            branch: lane.branch,
            sha: commit.sha,
            url: commit.url,
            at: commit.at,
            dockerfile: dockerfile?.path ?? null,
            packageJson: pkg?.path ?? null,
            node: dockerfile ? nodeFromDockerfile(dockerfile.text) : null,
            angular: pkg ? angularFromPackage(pkg.text, lock) : null,
          };
          found[lane.environment] = result;

          if (!deployment) {
            warnings.push(`${project.name} has no ${lane.environment} environment for ${lane.branch}.`);
            continue;
          }
          for (const [name, version] of [['Node.js', result.node], ['Angular', result.angular]] as const) {
            const tech = technologies.find((t) => t.name === name);
            if (!version || !tech) continue;
            const current = await this.currentVersion(deployment.id, tech.id);
            if (current === version) {
              await this.settle(deployment.id, tech.id);
              continue;
            }
            if (!firstRead) {
              await this.propose({ project, deploymentId: deployment.id, tech, current, version, repo: source.repo, branch: lane.branch, commit });
              proposals++;
              continue;
            }
            try {
              await this.deployments.changeComponent(
                deployment.id,
                {
                  technology: name,
                  toVersion: version,
                  effectiveAt: commit.at.slice(0, 10),
                  note: `From GitHub ${source.repo}@${lane.branch} · ${commit.sha.slice(0, 7)} "${commit.message}" by ${commit.author}`.slice(0, 500),
                  evidenceUrl: commit.url,
                },
                undefined,
                { fromSync: true },
              );
              changes++;
            } catch (error) {
              warnings.push(`${lane.environment} ${name} ${version}: ${message(error)}`);
            }
          }
        }

        if (!deployment) continue;
        if (!result.dockerfile) warnings.push(`No Dockerfile found on ${lane.branch}.`);
        if (!result.packageJson) warnings.push(`No package.json found on ${lane.branch}.`);
        for (const [name, version] of [['Node.js', result.node], ['Angular', result.angular]] as const) {
          const tech = technologies.find((t) => t.name === name);
          if (version && tech) managed.add(`${deployment.id}|${tech.id}`);
        }
      }

      await this.prisma.projectSource.update({
        where: { projectId },
        data: {
          found: found as unknown as Prisma.InputJsonValue,
          managed: [...managed] as Prisma.InputJsonValue,
          lastScanAt: new Date(),
          status: warnings.length ? 'WARN' : 'OK',
          message: warnings.length
            ? warnings.join(' ')
            : proposals
              ? `${proposals} new version${proposals === 1 ? '' : 's'} waiting for approval.`
              : changes
                ? `${changes} version change${changes === 1 ? '' : 's'} recorded.`
                : 'Up to date.',
        },
      });
      if (changes) this.logger.log(`${project.name}: ${changes} version change(s) from ${source.repo}`);
    } catch (error) {
      await this.prisma.projectSource.update({
        where: { projectId },
        data: { lastScanAt: new Date(), status: 'ERROR', message: message(error) },
      });
      if (!(error instanceof GitHubError)) this.logger.error(error);
    }
  }

  /** New versions waiting for approval (or the decided ones), newest first. */
  async proposals(status = 'PENDING') {
    const rows = await this.prisma.versionProposal.findMany({
      where: { status },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { project: { select: { name: true, code: true } } },
    });
    const deciders = await this.prisma.appUser.findMany({
      where: { id: { in: rows.map((r) => r.decidedById).filter((id): id is string => !!id) } },
      select: { id: true, displayName: true, email: true },
    });
    return rows.map((p) => ({
      id: p.id,
      project: p.project.name,
      projectCode: p.project.code,
      technology: p.technology,
      fromVersion: p.fromVersion,
      toVersion: p.toVersion,
      repo: p.repo,
      branch: p.branch,
      sha: p.sha,
      commitUrl: p.commitUrl,
      commitMessage: p.commitMessage,
      commitAuthor: p.commitAuthor,
      committedAt: p.committedAt.toISOString(),
      status: p.status,
      remindAt: p.remindAt.toISOString(),
      remindHours: p.remindHours,
      decidedBy: deciders.find((d) => d.id === p.decidedById)?.displayName ?? null,
      decidedAt: p.decidedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  /** Records the new version in EOL. Only done in the tool, by an Admin or SRE. */
  async approve(id: string, userId: string) {
    const p = await this.prisma.versionProposal.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('That change no longer exists.');
    if (p.status !== 'PENDING') throw new BadRequestException('That change was already decided.');

    const current = await this.currentVersion(p.deploymentId, p.technologyId);
    if (current !== p.toVersion) {
      await this.deployments.changeComponent(
        p.deploymentId,
        {
          technology: p.technology,
          toVersion: p.toVersion,
          effectiveAt: p.committedAt.toISOString().slice(0, 10),
          note: `Approved from GitHub ${p.repo}@${p.branch} · ${p.sha.slice(0, 7)} "${p.commitMessage}" by ${p.commitAuthor}`.slice(0, 500),
          evidenceUrl: p.commitUrl,
        },
        userId,
        { fromSync: true },
      );
    }
    await this.prisma.versionProposal.update({
      where: { id },
      data: { status: 'APPROVED', decidedById: userId, decidedAt: new Date() },
    });
    return { ok: true };
  }

  /** Not approved yet: Teams is reminded after this many hours, and again at that interval until someone decides. */
  async remindLater(id: string, hours: number) {
    if (![2, 12, 24, 72, 168].includes(hours)) throw new BadRequestException('Pick 2 hours, 12 hours, 1 day, 3 days or 7 days.');
    const p = await this.prisma.versionProposal.findUnique({ where: { id } });
    if (!p || p.status !== 'PENDING') throw new BadRequestException('That change is not waiting any more.');
    await this.prisma.versionProposal.update({
      where: { id },
      data: { remindHours: hours, remindAt: new Date(Date.now() + hours * 3_600_000) },
    });
    return { ok: true };
  }

  /** Sends the Teams reminder for every waiting change whose time has come. */
  async sendDueReminders(): Promise<void> {
    const due = await this.prisma.versionProposal.findMany({
      where: { status: 'PENDING', remindAt: { lte: new Date() } },
      include: { project: { select: { name: true, teamsIntegrationId: true } } },
    });
    for (const p of due) {
      const hoursWaiting = Math.round((Date.now() - p.createdAt.getTime()) / 3_600_000);
      await this.notify(p.project, {
        heading: 'Still waiting for approval',
        title: `${p.technology} ${p.toVersion} on ${p.project.name} (${waited(hoursWaiting)})`,
        proposal: p,
      });
      await this.prisma.versionProposal.update({
        where: { id: p.id },
        data: { remindAt: new Date(Date.now() + p.remindHours * 3_600_000), lastNotifiedAt: new Date() },
      });
    }
  }

  private async propose(input: {
    project: { id: string; name: string; teamsIntegrationId: string | null };
    deploymentId: string;
    tech: { id: string; name: string };
    current: string | null;
    version: string;
    repo: string;
    branch: string;
    commit: Awaited<ReturnType<GitHubApp['commit']>>;
  }): Promise<void> {
    const { project, deploymentId, tech, current, version, repo, branch, commit } = input;
    const waiting = await this.prisma.versionProposal.findFirst({
      where: { deploymentId, technologyId: tech.id, status: 'PENDING' },
    });
    if (waiting?.toVersion === version) return;

    const data = {
      fromVersion: current,
      toVersion: version,
      repo,
      branch,
      sha: commit.sha,
      commitUrl: commit.url,
      commitMessage: commit.message,
      commitAuthor: commit.author,
      committedAt: new Date(commit.at),
      lastNotifiedAt: new Date(),
    };
    const saved = waiting
      ? await this.prisma.versionProposal.update({
          where: { id: waiting.id },
          data: { ...data, remindAt: new Date(Date.now() + waiting.remindHours * 3_600_000) },
        })
      : await this.prisma.versionProposal.create({
          data: {
            ...data,
            projectId: project.id,
            deploymentId,
            technologyId: tech.id,
            technology: tech.name,
            remindAt: new Date(Date.now() + 24 * 3_600_000),
          },
        });
    await this.notify(project, { heading: 'New version on the production branch', title: `${tech.name} ${version} on ${project.name}`, proposal: saved });
  }

  /** The recorded version caught up (approved earlier, or changed another way): nothing left to wait for. */
  private async settle(deploymentId: string, technologyId: string): Promise<void> {
    await this.prisma.versionProposal.updateMany({
      where: { deploymentId, technologyId, status: 'PENDING' },
      data: { status: 'SUPERSEDED', decidedAt: new Date() },
    });
  }

  /** Teams only informs; approving happens in the tool. Goes to the project's channel, else the default one. */
  private async notify(
    project: { name: string; teamsIntegrationId: string | null },
    note: { heading: string; title: string; proposal: { technology: string; fromVersion: string | null; toVersion: string; repo: string; branch: string; sha: string; commitUrl: string; commitMessage: string; commitAuthor: string } },
  ): Promise<void> {
    const p = note.proposal;
    const card: NotificationCard = {
      severity: 'warning',
      heading: note.heading,
      title: note.title,
      facts: [
        { title: 'Change', value: `${p.technology} ${p.fromVersion ?? 'none'} → ${p.toVersion}` },
        { title: 'Where', value: `${p.repo} · ${p.branch} (production)` },
        { title: 'Commit', value: `${p.sha.slice(0, 7)} "${p.commitMessage}" by ${p.commitAuthor}` },
        { title: 'Next step', value: 'An Admin or SRE approves it in Lime EOL (Operations → Source code).' },
      ],
      mentions: [],
      actions: [
        { title: 'Open in Lime EOL', url: `${getEnv().APP_BASE_URL.replace(/\/$/, '')}/ops` },
        { title: 'View commit', url: p.commitUrl },
      ],
    };
    try {
      const channelId = await this.integrations.effectiveId('TEAMS', project.teamsIntegrationId);
      const channel = channelId ? await this.integrations.teamsUrl(channelId) : null;
      await (channel ? this.teams.sendTo(channel, card) : this.teams.send(card));
    } catch (error) {
      this.logger.warn(`Could not post "${note.title}" to Teams: ${message(error)}`);
    }
  }

  private async currentVersion(deploymentId: string, technologyId: string): Promise<string | null> {
    const row = await this.prisma.deploymentComponent.findFirst({
      where: { deploymentId, techVersion: { cycle: { technologyId } } },
      include: { techVersion: true },
    });
    return row?.techVersion.fullVersion ?? null;
  }

  private need(): GitHubApp {
    if (!this.github) {
      throw new BadRequestException('The GitHub App is not set up. Add GITHUB_APP_ID and the private key on the server.');
    }
    return this.github;
  }
}

async function firstFile(github: GitHubApp, repo: string, ref: string, paths: string[]) {
  for (const path of paths) {
    const text = await github.file(repo, path, ref);
    if (text !== null) return { path, text };
  }
  return null;
}

function toDto(s: ProjectSource & { project?: { name: string; code: string } }) {
  return {
    projectId: s.projectId,
    repo: s.repo,
    prodBranch: s.prodBranch,
    devBranch: s.devBranch,
    dockerfilePath: s.dockerfilePath,
    packagePath: s.packagePath,
    lastScanAt: s.lastScanAt?.toISOString() ?? null,
    status: s.status,
    message: s.message,
    found: s.found as unknown as Record<string, Found>,
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function waited(hours: number): string {
  if (hours < 24) return `waiting ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `waiting ${days} day${days === 1 ? '' : 's'}`;
}
