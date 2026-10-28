import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Integration, IntegrationKind, Prisma } from '@prisma/client';
import { hint, open, seal } from '../../common/utils/secrets';
import { jiraConfig, JiraConfig, notificationConfig, NotificationConfig } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import { JiraAdapter } from '../issue-tracker/adapters/jira.adapter';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto/integration.dto';

interface JiraSettings {
  baseUrl: string;
  email: string;
  projectKey: string;
  tokenType: 'scoped' | 'classic';
}

const TEAMS_HOSTS = /(\.webhook\.office\.com|\.logic\.azure\.com|\.powerplatform\.com|\.environment\.api\.powerplatform\.com)$/i;

@Injectable()
export class IntegrationsService {
  private readonly adapters = new Map<string, { stamp: number; adapter: JiraAdapter }>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(jiraConfig.KEY) private readonly jira: JiraConfig,
    @Inject(notificationConfig.KEY) private readonly notify: NotificationConfig,
  ) {}

  async list() {
    const rows = await this.prisma.integration.findMany({
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { jiraProjects: true, teamsProjects: true } } },
    });

    // Projects that picked no connection use the default one.
    const [jiraUnset, teamsUnset] = await Promise.all([
      this.prisma.project.count({ where: { archivedAt: null, jiraIntegrationId: null } }),
      this.prisma.project.count({ where: { archivedAt: null, teamsIntegrationId: null } }),
    ]);
    const unset = { JIRA: jiraUnset, TEAMS: teamsUnset };
    const chosen = (kind: IntegrationKind) => rows.find((r) => r.kind === kind && r.isDefault && r.enabled);

    const defaults = [
      {
        id: 'env-jira',
        kind: 'JIRA' as const,
        name: 'Server default',
        source: 'env' as const,
        enabled: this.jira.configured,
        isDefault: !chosen('JIRA'),
        viaDefault: chosen('JIRA') ? 0 : unset.JIRA,
        baseUrl: this.jira.baseUrl ?? null,
        email: this.jira.email ?? null,
        projectKey: this.jira.projectKey ?? null,
        tokenType: this.jira.scopedToken ? 'scoped' : 'classic',
        secretHint: this.jira.apiToken ? hint(this.jira.apiToken) : null,
        lastCheckedAt: null,
        lastOk: null,
        lastDetail: this.jira.configured ? null : 'Not set in .env',
        projects: 0,
      },
      {
        id: 'env-teams',
        kind: 'TEAMS' as const,
        name: 'Server default',
        source: 'env' as const,
        enabled: !!this.notify.teamsWebhookUrl,
        isDefault: !chosen('TEAMS'),
        viaDefault: chosen('TEAMS') ? 0 : unset.TEAMS,
        baseUrl: null,
        email: null,
        projectKey: null,
        tokenType: null,
        secretHint: this.notify.teamsWebhookUrl ? hint(this.notify.teamsWebhookUrl) : null,
        lastCheckedAt: null,
        lastOk: null,
        lastDetail: this.notify.teamsWebhookUrl ? null : 'Not set in .env',
        projects: 0,
      },
    ];

    return [
      ...defaults,
      ...rows.map((row) => this.toResponse(row, row._count, chosen(row.kind)?.id === row.id ? unset[row.kind] : 0)),
    ];
  }

  async options() {
    const rows = await this.prisma.integration.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' },
      select: { id: true, kind: true, name: true, settings: true },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      projectKey: row.kind === 'JIRA' ? (row.settings as unknown as JiraSettings).projectKey : null,
    }));
  }

  async create(input: CreateIntegrationDto, userId: string) {
    const secret = input.secret?.trim();
    if (!secret) {
      throw new BadRequestException(
        input.kind === 'JIRA' ? 'Enter the Jira API token.' : 'Enter the Teams webhook URL.',
      );
    }

    const settings = this.settingsFor(input.kind, input, null);
    this.checkSecret(input.kind, secret);

    try {
      const row = await this.prisma.integration.create({
        data: {
          kind: input.kind as IntegrationKind,
          name: input.name.trim(),
          settings: settings as unknown as Prisma.InputJsonValue,
          secret: seal(secret),
          secretHint: hint(secret),
          enabled: input.enabled ?? true,
          createdById: userId,
        },
      });
      return this.test(row.id);
    } catch (error) {
      throw this.duplicate(error);
    }
  }

  async update(id: string, input: UpdateIntegrationDto) {
    const current = await this.mustExist(id);
    const secret = input.secret?.trim();
    if (secret) this.checkSecret(current.kind, secret);

    try {
      await this.prisma.integration.update({
        where: { id },
        data: {
          name: input.name?.trim(),
          enabled: input.enabled,
          // Switching a default off hands the default back to .env.
          ...(input.enabled === false ? { isDefault: false } : {}),
          settings: this.settingsFor(current.kind, input, current.settings) as unknown as Prisma.InputJsonValue,
          ...(secret ? { secret: seal(secret), secretHint: hint(secret) } : {}),
          lastCheckedAt: null,
          lastOk: null,
          lastDetail: null,
        },
      });
    } catch (error) {
      throw this.duplicate(error);
    }

    this.adapters.delete(id);
    return this.test(id);
  }

  /**
   * Deletes a connection. Projects using it move to `moveTo` (another connection of the same kind),
   * or to the default when it is omitted. Jira issues already linked keep their link.
   */
  async remove(id: string, moveTo?: string): Promise<void> {
    const row = await this.mustExist(id);
    const target = moveTo && moveTo !== 'default' ? await this.mustExist(moveTo) : null;
    if (target && (target.kind !== row.kind || target.id === row.id)) {
      throw new BadRequestException('Move the projects to another connection of the same type.');
    }

    const field = row.kind === 'JIRA' ? 'jiraIntegrationId' : 'teamsIntegrationId';
    await this.prisma.$transaction([
      this.prisma.project.updateMany({ where: { [field]: id }, data: { [field]: target?.id ?? null } }),
      this.prisma.integration.delete({ where: { id } }),
    ]);
    this.adapters.delete(id);
  }

  /** Makes a connection the default for projects that picked none. "env-jira" / "env-teams" go back to .env. */
  async makeDefault(id: string) {
    const envKind = id === 'env-jira' ? 'JIRA' : id === 'env-teams' ? 'TEAMS' : null;
    const row = envKind ? null : await this.mustExist(id);
    const kind = (envKind ?? row!.kind) as IntegrationKind;
    if (row && !row.enabled) {
      throw new BadRequestException('Switch the connection on before making it the default.');
    }

    await this.prisma.$transaction([
      this.prisma.integration.updateMany({ where: { kind, isDefault: true }, data: { isDefault: false } }),
      ...(row ? [this.prisma.integration.update({ where: { id: row.id }, data: { isDefault: true } })] : []),
    ]);
    return this.list();
  }

  /** The connection chosen as default, if it is switched on. Null means use the .env one. */
  async defaultId(kind: 'JIRA' | 'TEAMS'): Promise<string | null> {
    const row = await this.prisma.integration.findFirst({ where: { kind, isDefault: true, enabled: true } });
    return row?.id ?? null;
  }

  /** The connection a project uses: its own when switched on, otherwise the default. */
  async effectiveId(kind: 'JIRA' | 'TEAMS', projectChoice: string | null): Promise<string | null> {
    if (projectChoice) {
      const own = await this.prisma.integration.findUnique({ where: { id: projectChoice } });
      if (own?.enabled) return own.id;
    }
    return this.defaultId(kind);
  }

  /** The default Teams channel chosen on screen, if any. */
  async defaultTeams(): Promise<{ name: string; url: string } | null> {
    const id = await this.defaultId('TEAMS');
    return id ? this.teamsUrl(id) : null;
  }

  async test(id: string) {
    const row = await this.mustExist(id);
    let result: { ok: boolean; detail: string };

    try {
      result = row.kind === 'JIRA' ? await this.testJira(row) : await this.testTeams(row);
    } catch (error) {
      result = { ok: false, detail: error instanceof Error ? error.message : 'The check failed.' };
    }

    const saved = await this.prisma.integration.update({
      where: { id },
      data: { lastCheckedAt: new Date(), lastOk: result.ok, lastDetail: result.detail.slice(0, 500) },
      include: { _count: { select: { jiraProjects: true, teamsProjects: true } } },
    });
    return this.toResponse(saved, saved._count);
  }

  async jiraFor(id: string, projectKey?: string | null): Promise<JiraAdapter> {
    const row = await this.prisma.integration.findUnique({ where: { id } });
    if (!row || row.kind !== 'JIRA') {
      throw new BadRequestException('That Jira connection no longer exists.');
    }
    if (!row.enabled) {
      throw new BadRequestException(`The Jira connection "${row.name}" is switched off.`);
    }

    const key = `${id}|${projectKey ?? ''}`;
    const cached = this.adapters.get(key);
    if (cached && cached.stamp === row.updatedAt.getTime()) {
      return cached.adapter;
    }

    const settings = row.settings as unknown as JiraSettings;
    const config = {
      baseUrl: settings.baseUrl.replace(/\/+$/, ''),
      email: settings.email,
      apiToken: open(row.secret),
      projectKey: projectKey || settings.projectKey,
      cron: this.jira.cron,
      timeoutMs: this.jira.timeoutMs,
      demo: false,
      createOnPlan: false,
      scopedToken: settings.tokenType === 'scoped',
      missing: [],
      configured: true,
    } as unknown as JiraConfig;

    const adapter = new JiraAdapter(config);
    this.adapters.set(key, { stamp: row.updatedAt.getTime(), adapter });
    return adapter;
  }

  async teamsUrl(id: string): Promise<{ name: string; url: string } | null> {
    const row = await this.prisma.integration.findUnique({ where: { id } });
    if (!row || row.kind !== 'TEAMS' || !row.enabled) return null;
    return { name: row.name, url: open(row.secret) };
  }

  private async testJira(row: Integration) {
    const adapter = await this.jiraFor(row.id);
    const check = await adapter.check();
    if (!check.ok) return check;

    const key = (row.settings as unknown as JiraSettings).projectKey;
    try {
      await adapter.getProject(key);
      return { ok: true, detail: `${check.detail} Board ${key} found.` };
    } catch (error) {
      return {
        ok: false,
        detail: `Signed in, but board ${key} could not be read: ${error instanceof Error ? error.message : error}`,
      };
    }
  }

  private async testTeams(row: Integration) {
    const response = await fetch(open(row.secret), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            contentUrl: null,
            content: {
              type: 'AdaptiveCard',
              $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
              version: '1.4',
              body: [
                { type: 'TextBlock', text: 'Lime Lifecycle is connected', weight: 'Bolder', size: 'Medium' },
                { type: 'TextBlock', text: `This channel is now linked as "${row.name}".`, wrap: true },
              ],
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    return response.ok
      ? { ok: true, detail: 'A test message was posted to the channel.' }
      : { ok: false, detail: `Teams answered HTTP ${response.status} ${response.statusText}`.trim() };
  }

  private settingsFor(
    kind: IntegrationKind | string,
    input: Partial<CreateIntegrationDto>,
    current: Prisma.JsonValue | null,
  ): Partial<JiraSettings> {
    if (kind !== 'JIRA') return {};

    const before = (current ?? {}) as Partial<JiraSettings>;
    const merged: JiraSettings = {
      baseUrl: (input.baseUrl ?? before.baseUrl ?? '').replace(/\/+$/, ''),
      email: input.email ?? before.email ?? '',
      projectKey: input.projectKey ?? before.projectKey ?? '',
      tokenType: input.tokenType ?? before.tokenType ?? 'classic',
    };

    if (!merged.baseUrl || !merged.email || !merged.projectKey) {
      throw new BadRequestException('A Jira connection needs the site URL, the account email and a project key.');
    }
    if (!/^https:\/\/[^/]+$/.test(merged.baseUrl)) {
      throw new BadRequestException('Use the site address only, like https://your-team.atlassian.net.');
    }
    return merged;
  }

  private checkSecret(kind: IntegrationKind | string, secret: string): void {
    if (kind !== 'TEAMS') return;
    let url: URL;
    try {
      url = new URL(secret);
    } catch {
      throw new BadRequestException('The Teams webhook must be a full https:// URL.');
    }
    if (url.protocol !== 'https:' || !TEAMS_HOSTS.test(url.hostname)) {
      throw new BadRequestException(
        'That is not a Microsoft Teams or Power Automate webhook address.',
      );
    }
  }

  private async mustExist(id: string): Promise<Integration> {
    const row = await this.prisma.integration.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('No such connection.');
    return row;
  }

  private duplicate(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('A connection of that type already has this name.');
    }
    return error;
  }

  private toResponse(row: Integration, count: { jiraProjects: number; teamsProjects: number }, viaDefault = 0) {
    const settings = (row.settings ?? {}) as Partial<JiraSettings>;
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      source: 'ui' as const,
      enabled: row.enabled,
      isDefault: row.isDefault && row.enabled,
      viaDefault,
      baseUrl: settings.baseUrl ?? null,
      email: settings.email ?? null,
      projectKey: settings.projectKey ?? null,
      tokenType: settings.tokenType ?? null,
      secretHint: row.secretHint,
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
      lastOk: row.lastOk,
      lastDetail: row.lastDetail,
      projects: row.kind === 'JIRA' ? count.jiraProjects : count.teamsProjects,
    };
  }
}
