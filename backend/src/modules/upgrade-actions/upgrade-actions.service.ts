import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ActionStatus, CommStatus, CustomerAgreement } from '@prisma/client';
import { coverageOf, currentAgreement, termsFor } from '../customers/agreement.util';
import { can, Permission } from '../auth/permissions';
import { jiraConfig, JiraConfig } from '../../config';
import { IssueTrackerService, toSubtask } from '../issue-tracker/issue-tracker.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CompleteEnvironmentDto,
  CreateUpgradeActionDto,
  UpdateUpgradeActionDto,
} from './dto/upgrade-action.dto';

const MS_PER_DAY = 86_400_000;

@Injectable()
export class UpgradeActionsService {
  private readonly logger = new Logger(UpgradeActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tracker: IssueTrackerService,
    @Inject(jiraConfig.KEY) private readonly jira: JiraConfig,
  ) {}

  async findAll(filters: { projectId?: string; assigneeId?: string } = {}) {
    const actions = await this.prisma.upgradeAction.findMany({
      orderBy: [{ plannedDate: 'asc' }, { createdAt: 'desc' }],
      include: ACTION_INCLUDE,
      where: filters.assigneeId ? { assigneeId: filters.assigneeId } : undefined,
    });

    const filtered = filters.projectId
      ? actions.filter((a) =>
          a.deployments.some((d) => d.deployment.projectId === filters.projectId),
        )
      : actions;

    return Promise.all(filtered.map((action) => this.toDto(action)));
  }

  async findOne(id: string) {
    const action = await this.prisma.upgradeAction.findUnique({
      where: { id },
      include: ACTION_INCLUDE,
    });

    if (!action) {
      throw new NotFoundException(`No upgrade action "${id}"`);
    }
    return this.toDto(action);
  }

  async create(input: CreateUpgradeActionDto) {
    const cycle = await this.prisma.technologyCycle.findUnique({
      where: { id: input.technologyCycleId },
    });
    if (!cycle) {
      throw new BadRequestException('That cycle is not in the registry.');
    }

    const action = await this.prisma.upgradeAction.create({
      data: {
        technologyCycleId: input.technologyCycleId,
        targetVersion: input.targetVersion ?? null,
        assigneeId: input.assigneeId ?? null,
        teamId: input.teamId ?? null,
        startDate: toDate(input.startDate),
        plannedDate: toDate(input.plannedDate),
        status: (input.status ?? 'PLANNED') as ActionStatus,
        customerComm: (input.customerComm ?? 'NOT_REQUIRED') as CommStatus,
        customerCommNotes: input.customerCommNotes ?? null,
        remarks: input.remarks ?? null,
        decision: input.decision ?? null,
        assessment: input.assessment?.trim() || null,
        riskApprover: input.riskApprover?.trim() || null,
        riskExpiresAt: toDate(input.riskExpiresAt ?? undefined),
        customerNotifiedAt: toDate(input.customerNotifiedAt ?? undefined),
        deployments: {
          create: input.deploymentIds.map((deploymentId) => ({ deploymentId })),
        },
      },
      include: ACTION_INCLUDE,
    });

    await this.raiseIssueFor(action.id);

    return this.toDto(action);
  }

  private async raiseIssueFor(actionId: string): Promise<void> {
    if (!this.jira.createOnPlan) {
      return;
    }

    try {
      await this.tracker.createFor(actionId);
    } catch (error) {
      this.logger.warn(
        `Planned the upgrade but could not raise its Jira issue: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async update(id: string, input: UpdateUpgradeActionDto, role?: string) {
    await this.findOne(id);
    assertFieldsAllowed(input, role);

    if (input.deploymentIds) {
      await this.prisma.$transaction([
        this.prisma.upgradeActionDeployment.deleteMany({
          where: {
            upgradeActionId: id,
            deploymentId: { notIn: input.deploymentIds },
          },
        }),
        ...input.deploymentIds.map((deploymentId) =>
          this.prisma.upgradeActionDeployment.upsert({
            where: {
              upgradeActionId_deploymentId: { upgradeActionId: id, deploymentId },
            },
            update: {},
            create: { upgradeActionId: id, deploymentId },
          }),
        ),
      ]);
    }

    const action = await this.prisma.upgradeAction.update({
      where: { id },
      data: {
        targetVersion: input.targetVersion,
        assigneeId: input.assigneeId,
        teamId: input.teamId,
        startDate: input.startDate ? toDate(input.startDate) : undefined,
        plannedDate: input.plannedDate ? toDate(input.plannedDate) : undefined,
        completedDate: input.completedDate ? toDate(input.completedDate) : undefined,
        status: input.status as ActionStatus | undefined,
        customerComm: input.customerComm as CommStatus | undefined,
        customerCommNotes: input.customerCommNotes,
        remarks: input.remarks,
        decision: input.decision,
        assessment: input.assessment === undefined ? undefined : input.assessment?.trim() || null,
        riskApprover:
          input.riskApprover === undefined ? undefined : input.riskApprover?.trim() || null,
        riskExpiresAt:
          input.riskExpiresAt === undefined ? undefined : toDate(input.riskExpiresAt ?? undefined),
        customerNotifiedAt:
          input.customerNotifiedAt === undefined
            ? undefined
            : toDate(input.customerNotifiedAt ?? undefined),
      },
      include: ACTION_INCLUDE,
    });

    return this.toDto(action);
  }

  async completeEnvironment(id: string, input: CompleteEnvironmentDto) {
    const completedAt = toDate(input.completedAt) ?? today();

    await this.prisma.upgradeActionDeployment.update({
      where: {
        upgradeActionId_deploymentId: {
          upgradeActionId: id,
          deploymentId: input.deploymentId,
        },
      },
      data: { completedAt },
    });

    const action = await this.prisma.upgradeAction.findUniqueOrThrow({
      where: { id },
      include: ACTION_INCLUDE,
    });

    const allDone = action.deployments.every((d) => d.completedAt !== null);

    if (allDone && action.status !== 'COMPLETED') {
      const updated = await this.prisma.upgradeAction.update({
        where: { id },
        data: { status: 'COMPLETED', completedDate: completedAt },
        include: ACTION_INCLUDE,
      });
      return this.toDto(updated);
    }

    return this.toDto(action);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.upgradeAction.delete({ where: { id } });
  }

  private async verify(action: ActionRow) {
    const technologyId = action.cycle.technologyId;
    const deploymentIds = action.deployments.map((d) => d.deploymentId);

    const changes = await this.prisma.componentChange.findMany({
      where: {
        technologyId,
        deploymentId: { in: deploymentIds },
        effectiveAt: { gte: action.createdAt },
      },
      include: { toVersion_: { include: { cycle: true } } },
      orderBy: { effectiveAt: 'desc' },
    });

    const verified = new Set<string>();

    for (const change of changes) {
      const landedOn = change.toVersion_?.cycle;
      if (!landedOn) {
        continue;
      }

      const matchesTarget =
        (action.targetVersion && change.toVersion === action.targetVersion) ||
        landedOn.id !== action.technologyCycleId;

      if (matchesTarget) {
        verified.add(change.deploymentId);
      }
    }

    return verified;
  }

  private async toDto(action: ActionRow) {
    const verified = await this.verify(action);

    const environments = action.deployments.map((link) => ({
      deploymentId: link.deploymentId,
      project: link.deployment.project?.name ?? link.deployment.customer.name,
      projectId: link.deployment.projectId,
      environment: link.deployment.environment,
      completedAt: isoDate(link.completedAt),
      verified: verified.has(link.deploymentId),
    }));

    const done = environments.filter((e) => e.completedAt !== null).length;
    const eolDate = action.cycle.eolDate;
    const plannedDate = action.plannedDate;

    return {
      id: action.id,
      technology: action.cycle.technology.name,
      technologyCycleId: action.technologyCycleId,
      cycle: action.cycle.cycle,
      eolDate: isoDate(eolDate),
      daysToEol: eolDate ? daysUntil(eolDate) : null,
      targetVersion: action.targetVersion,
      status: action.status,
      derivedStatus: deriveStatus(action.status, done, environments.length, plannedDate),
      startDate: isoDate(action.startDate),
      plannedDate: isoDate(plannedDate),
      completedDate: isoDate(action.completedDate),
      assignee: action.assignee
        ? {
            id: action.assignee.id,
            name: action.assignee.displayName ?? action.assignee.email,
          }
        : null,
      team: action.team ? { id: action.team.id, name: action.team.name } : null,
      jiraKey: action.jiraKey,
      jiraUrl: action.jiraUrl,
      jiraSyncError: action.jiraSyncError,
      subtasks: (action.jiraSubtasks ?? []).map(toSubtask),
      jiraStatusCategory: action.jiraStatusCategory,
      jiraSubtaskDone: action.jiraSubtaskDone,
      jiraSubtaskTotal: action.jiraSubtaskTotal,
      customerComm: action.customerComm,
      customerCommNotes: action.customerCommNotes,
      customerNotifiedAt: isoDate(action.customerNotifiedAt),
      remarks: action.remarks,
      decision: action.decision,
      assessment: action.assessment,
      riskApprover: action.riskApprover,
      riskExpiresAt: isoDate(action.riskExpiresAt),
      environments,
      progress: { done, total: environments.length },
      unverifiedCompletion:
        done > 0 && environments.some((e) => e.completedAt !== null && !e.verified),
      planTooLate:
        plannedDate !== null &&
        eolDate !== null &&
        plannedDate.getTime() > eolDate.getTime(),
      scope: action.cycle.technology.scope,
      terms: termsFor(
        action.cycle.technology.scope,
        coverageOf(currentAgreement(action.deployments[0]?.deployment.customer.agreements ?? [])),
      ),
      createdAt: action.createdAt.toISOString(),
    };
  }
}

const ACTION_INCLUDE = {
  cycle: { include: { technology: true } },
  assignee: true,
  team: true,
  deployments: {
    include: { deployment: { include: { project: true, customer: { include: { agreements: true } } } } },
  },
  jiraSubtasks: { orderBy: { position: 'asc' } },
} as const;

type ActionRow = Awaited<
  ReturnType<PrismaService['upgradeAction']['findUniqueOrThrow']>
> & {
  cycle: { technologyId: string; technology: { name: string; scope: 'INFRASTRUCTURE' | 'APPLICATION' }; cycle: string; eolDate: Date | null; id: string };
  assignee: { id: string; displayName: string | null; email: string } | null;
  team: { id: string; name: string } | null;
  jiraSubtasks: Parameters<typeof toSubtask>[0][];
  deployments: {
    deploymentId: string;
    completedAt: Date | null;
    deployment: {
      environment: string;
      projectId: string | null;
      project: { name: string } | null;
      customer: { name: string; agreements: CustomerAgreement[] };
    };
  }[];
};

function deriveStatus(
  stored: ActionStatus,
  done: number,
  total: number,
  plannedDate: Date | null,
): string {
  if (stored === 'DEFERRED') {
    return 'DEFERRED';
  }
  if (total > 0 && done === total) {
    return 'COMPLETED';
  }
  if (done > 0) {
    return 'IN_PROGRESS';
  }
  if (plannedDate && plannedDate.getTime() < today().getTime()) {
    return 'OVERDUE';
  }
  return stored;
}

function daysUntil(date: Date): number {
  return Math.round((date.getTime() - today().getTime()) / MS_PER_DAY);
}

function today(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

const FIELD_PERMISSION: Partial<Record<keyof UpdateUpgradeActionDto, Permission>> = {
  customerComm: 'plan:notice',
  customerCommNotes: 'plan:notice',
  customerNotifiedAt: 'plan:notice',
  decision: 'plan:decision',
  riskApprover: 'plan:decision',
  riskExpiresAt: 'plan:decision',
  assessment: 'plan:assess',
};

function assertFieldsAllowed(input: UpdateUpgradeActionDto, role?: string): void {
  if (role === undefined) return;

  const refused = (Object.keys(input) as (keyof UpdateUpgradeActionDto)[])
    .filter((field) => input[field] !== undefined)
    .filter((field) => !can(role, FIELD_PERMISSION[field] ?? 'estate:write'));

  if (refused.length > 0) {
    throw new ForbiddenException(`Your role cannot change: ${refused.join(', ')}.`);
  }
}

function toDate(value?: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function isoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
