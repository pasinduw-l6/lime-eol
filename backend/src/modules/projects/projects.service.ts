import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DeploymentsService } from '../deployments/deployments.service';
import { CreateProjectDto } from './dto/create-project.dto';
import {
  ComponentDto,
  EnvironmentDto,
  ProjectDto,
} from './dto/project-response.dto';

const MS_PER_DAY = 86_400_000;
const NOTICE_DAYS = 180;

const LIME_TECHNOLOGY = 'Lime';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deployments: DeploymentsService,
  ) {}

  async findAll(): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
      include: {
        customer: true,
        engineers: { include: { user: true } },
        deployments: {
          where: { archivedAt: null },
          orderBy: { environment: 'asc' },
          include: {
            owners: { include: { team: true } },
            overrides: {
              include: {
                techVersion: {
                  include: { cycle: { include: { technology: true } } },
                },
              },
            },
          },
        },
      },
    });

    return projects.map((project) => {
      const environments = project.deployments.map((deployment) =>
        this.toEnvironment(deployment),
      );

      return {
        id: project.id,
        name: project.name,
        customer: project.customer.name,
        code: project.code,
        limeVersion: project.limeVersion,
        status: project.status,
        startedAt: project.startedAt
          ? project.startedAt.toISOString().slice(0, 10)
          : null,
        engineers: project.engineers.map((link) => ({
          id: link.user.id,
          name: link.user.displayName ?? link.user.email,
          initials: initialsOf(link.user.displayName ?? link.user.email),
          isLead: link.isLead,
        })),
        environments,
        risk: riskOf(environments),
      };
    });
  }

  async create(input: CreateProjectDto, actorId?: string): Promise<ProjectDto> {
    const existing = await this.prisma.project.findUnique({
      where: { code: input.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`A project with code ${input.code} already exists.`);
    }

    for (const entry of input.stack) {
      const known = await this.prisma.technology.findUnique({
        where: { name: entry.technology },
      });
      if (!known) {
        throw new BadRequestException(
          `"${entry.technology}" is not in the registry. Add it under Lifecycle → Registry first.`,
        );
      }
    }

    const customer = await this.prisma.customer.upsert({
      where: { name: input.customer },
      update: {},
      create: { name: input.customer, code: input.code.toUpperCase() },
    });

    const project = await this.prisma.project.create({
      data: {
        customerId: customer.id,
        name: input.name,
        code: input.code.toUpperCase(),
        limeVersion: input.limeVersion,
        status: input.status ?? 'ONBOARDING',
        startedAt: input.startedAt
          ? new Date(`${input.startedAt}T00:00:00.000Z`)
          : new Date(),
        engineers: {
          create: (input.engineerIds ?? []).map((userId, index) => ({
            userId,
            isLead: index === 0,
          })),
        },
        deployments: {
          create: input.environments.map((env) => ({
            customerId: customer.id,
            name: `${input.name} ${env.environment}`,
            environment: env.environment,
            location: env.location,
            locationDetail: env.locationDetail,
          })),
        },
      },
      include: { deployments: true },
    });

    const effectiveAt = input.startedAt ?? new Date().toISOString().slice(0, 10);

    const stack = [...input.stack];
    if (
      input.limeVersion &&
      !stack.some((entry) => entry.technology === LIME_TECHNOLOGY)
    ) {
      await this.ensureLimeTechnology();
      stack.unshift({
        technology: LIME_TECHNOLOGY,
        version: input.limeVersion,
      });
    }

    for (const deployment of project.deployments) {
      for (const entry of stack) {
        await this.deployments.changeComponent(
          deployment.id,
          {
            technology: entry.technology,
            toVersion: entry.version,
            effectiveAt,
            reason: 'INITIAL_RECORD',
            note: `Recorded when ${project.name} was created`,
          },
          actorId,
        );
      }
    }

    return this.findOne(project.id);
  }

  async activity(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: isUuid(projectId)
        ? { id: projectId }
        : { code: projectId.toUpperCase() },
      include: { deployments: true },
    });

    if (!project) {
      throw new NotFoundException(`No project "${projectId}"`);
    }

    const changes = await this.prisma.componentChange.findMany({
      where: { deploymentId: { in: project.deployments.map((d) => d.id) } },
      orderBy: [{ effectiveAt: 'desc' }, { recordedAt: 'desc' }],
      include: { technology: true, recordedBy: true, deployment: true },
    });

    return changes.map((change) => ({
      id: change.id,
      kind: 'DONE' as const,
      date: change.effectiveAt.toISOString().slice(0, 10),
      recordedAt: change.recordedAt.toISOString(),
      technology: change.technology.name,
      fromVersion: change.fromVersion,
      toVersion: change.toVersion,
      changeType: change.changeType,
      reason: change.reason,
      ticketRef: change.ticketRef,
      evidenceUrl: change.evidenceUrl,
      note: change.note,
      recordedBy: change.recordedBy?.displayName ?? null,
      environment: change.deployment.environment,
    }));
  }

  private async ensureLimeTechnology(): Promise<void> {
    await this.prisma.technology.upsert({
      where: { name: LIME_TECHNOLOGY },
      update: {},
      create: {
        name: LIME_TECHNOLOGY,
        componentType: 'FRAMEWORK',
        vendor: 'LinearSix',
        eolSlug: null,
        cycleRule: 'MAJOR_MINOR',
        notes: 'Our own product. Versions are tracked to know what each customer runs.',
      },
    });
  }

  async setEngineers(
    projectId: string,
    engineerIds: string[],
    leadId?: string,
  ): Promise<ProjectDto> {
    const project = await this.prisma.project.findFirst({
      where: isUuid(projectId)
        ? { id: projectId }
        : { code: projectId.toUpperCase() },
    });

    if (!project) {
      throw new NotFoundException(`No project "${projectId}"`);
    }

    const ids = [...new Set(engineerIds)];

    const known = await this.prisma.appUser.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    });

    if (known.length !== ids.length) {
      throw new BadRequestException(
        'One of those people is not an active account.',
      );
    }

    const lead = leadId && ids.includes(leadId) ? leadId : ids[0];

    await this.prisma.$transaction([
      this.prisma.projectEngineer.deleteMany({ where: { projectId: project.id } }),
      this.prisma.projectEngineer.createMany({
        data: ids.map((userId) => ({
          projectId: project.id,
          userId,
          isLead: userId === lead,
        })),
      }),
    ]);

    return this.findOne(project.id);
  }

  async findOne(id: string): Promise<ProjectDto> {
    const projects = await this.findAll();
    const project = projects.find((p) => p.id === id || p.code === id);

    if (!project) {
      throw new NotFoundException(`No project "${id}"`);
    }
    return project;
  }

  private toEnvironment(deployment: {
    id: string;
    environment: string;
    location: string;
    locationDetail: string | null;
    owners: { team: { name: string } }[];
    overrides: {
      techVersion: {
        fullVersion: string;
        cycle: {
          cycle: string;
          eolDate: Date | null;
          activeSupportEnd: Date | null;
          latestPatch: string | null;
          eolSource: string;
          technology: { name: string; componentType: string };
        };
      };
    }[];
  }): EnvironmentDto {
    return {
      id: deployment.id,
      environment: deployment.environment,
      location: deployment.location,
      locationDetail: deployment.locationDetail,
      owners: deployment.owners.map((o) => o.team.name),
      components: deployment.overrides
        .map((entry) => this.toComponent(entry.techVersion))
        .sort((a, b) => (a.daysToEol ?? 1e9) - (b.daysToEol ?? 1e9)),
    };
  }

  private toComponent(version: {
    fullVersion: string;
    cycle: {
      cycle: string;
      eolDate: Date | null;
      activeSupportEnd: Date | null;
      latestPatch: string | null;
      eolSource: string;
      technology: { name: string; componentType: string };
    };
  }): ComponentDto {
    const days = daysUntil(version.cycle.eolDate);

    return {
      technology: version.cycle.technology.name,
      componentType: version.cycle.technology.componentType,
      version: version.fullVersion,
      cycle: version.cycle.cycle,
      eolDate: isoDate(version.cycle.eolDate),
      activeSupportEnd: isoDate(version.cycle.activeSupportEnd),
      latestPatch: version.cycle.latestPatch,
      daysToEol: days,
      status: statusOf(days),
      eolSource: version.cycle.eolSource,
    };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID.test(value);
}

function statusOf(days: number | null): string {
  if (days === null) {
    return 'UNKNOWN';
  }
  if (days <= 0) {
    return 'EOL';
  }
  return days <= NOTICE_DAYS ? 'NEAR' : 'SUPPORTED';
}

function daysUntil(date: Date | null): number | null {
  if (!date) {
    return null;
  }
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((date.getTime() - todayUtc) / MS_PER_DAY);
}

function isoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function riskOf(environments: EnvironmentDto[]): { eol: number; near: number } {
  const seen = new Set<string>();
  let eol = 0;
  let near = 0;

  for (const environment of environments) {
    for (const component of environment.components) {
      const key = `${component.technology}@${component.version}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      if (component.status === 'EOL') {
        eol++;
      } else if (component.status === 'NEAR') {
        near++;
      }
    }
  }
  return { eol, near };
}

function initialsOf(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
