import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type Level = AccessLevel | null;
export type ScopeKind = 'project' | 'deployment' | 'action' | 'customer' | 'deployments' | 'global';

export interface UserScope {
  admin: boolean;
  all: Level;
  projects: Map<string, Level>;
}

const RANK: Record<string, number> = { VIEW: 1, EDIT: 2 };

export function rank(level: Level | undefined): number {
  return level ? RANK[level] ?? 0 : 0;
}

export function higher(a: Level | undefined, b: Level | undefined): Level {
  return rank(a) >= rank(b) ? (a ?? null) : (b ?? null);
}

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async scope(userId: string): Promise<UserScope> {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        role: true,
        allProjects: true,
        projectAccess: { select: { projectId: true, level: true } },
        projects: { select: { projectId: true } },
      },
    });

    if (!user) return { admin: false, all: null, projects: new Map() };
    if (user.role === 'ADMIN') return { admin: true, all: 'EDIT', projects: new Map() };

    const projects = new Map<string, Level>();
    for (const row of user.projectAccess) projects.set(row.projectId, higher(projects.get(row.projectId), row.level));
    for (const row of user.projects) projects.set(row.projectId, 'EDIT');
    return { admin: false, all: user.allProjects, projects };
  }

  levelIn(scope: UserScope, projectId: string): Level {
    return higher(scope.all, scope.projects.get(projectId));
  }

  async levelFor(userId: string, projectId: string): Promise<Level> {
    return this.levelIn(await this.scope(userId), projectId);
  }

  async visibleProjectIds(userId: string): Promise<string[] | null> {
    const scope = await this.scope(userId);
    if (rank(scope.all) >= RANK.VIEW) return null;
    return [...scope.projects.entries()].filter(([, level]) => rank(level) >= RANK.VIEW).map(([id]) => id);
  }

  async visibleCustomerIds(userId: string): Promise<string[] | null> {
    const ids = await this.visibleProjectIds(userId);
    if (ids === null) return null;
    const rows = await this.prisma.project.findMany({
      where: { id: { in: ids } },
      select: { customerId: true },
    });
    return [...new Set(rows.map((r) => r.customerId))];
  }

  async projectsOf(kind: ScopeKind, value: unknown): Promise<string[] | null> {
    switch (kind) {
      case 'project': {
        const project = await this.prisma.project.findUnique({ where: { id: String(value) }, select: { id: true } });
        return project ? [project.id] : null;
      }
      case 'deployment': {
        const deployment = await this.prisma.deployment.findUnique({
          where: { id: String(value) },
          select: { projectId: true },
        });
        return deployment ? (deployment.projectId ? [deployment.projectId] : []) : null;
      }
      case 'deployments': {
        const ids = Array.isArray(value) ? value.map(String) : [];
        const rows = await this.prisma.deployment.findMany({
          where: { id: { in: ids } },
          select: { projectId: true },
        });
        return [...new Set(rows.map((r) => r.projectId).filter((p): p is string => !!p))];
      }
      case 'action': {
        const action = await this.prisma.upgradeAction.findUnique({
          where: { id: String(value) },
          select: { deployments: { select: { deployment: { select: { projectId: true } } } } },
        });
        if (!action) return null;
        return [
          ...new Set(action.deployments.map((d) => d.deployment.projectId).filter((p): p is string => !!p)),
        ];
      }
      case 'customer': {
        const customer = await this.prisma.customer.findUnique({
          where: { id: String(value) },
          select: { projects: { select: { id: true } } },
        });
        return customer ? customer.projects.map((p) => p.id) : null;
      }
      case 'global':
        return [];
    }
  }

  async check(userId: string, kind: ScopeKind, value: unknown, need: AccessLevel): Promise<void> {
    const scope = await this.scope(userId);
    if (scope.admin) return;

    const projects = await this.projectsOf(kind, value);
    if (projects === null) return;

    const required = RANK[need]!;
    if (kind === 'global') {
      if (rank(scope.all) >= required) return;
      throw new ForbiddenException(
        required > RANK.VIEW
          ? 'Only people with edit access to all projects can do that.'
          : 'Only people with access to all projects can see that.',
      );
    }
    const levels = projects.map((id) => rank(this.levelIn(scope, id)));

    const canSee =
      projects.length === 0 ? rank(scope.all) >= RANK.VIEW : levels.some((level) => level >= RANK.VIEW);
    if (!canSee) {
      throw new NotFoundException('That is not in a project you can see.');
    }

    if (required <= RANK.VIEW) return;

    const canEdit =
      projects.length === 0
        ? rank(scope.all) >= required
        : kind === 'action' || kind === 'deployments'
          ? levels.every((level) => level >= required)
          : levels.some((level) => level >= required);
    if (!canEdit) {
      throw new ForbiddenException(
        projects.length === 0
          ? 'Only people with access to all projects can do that.'
          : 'You have view-only access to that project.',
      );
    }
  }
}
