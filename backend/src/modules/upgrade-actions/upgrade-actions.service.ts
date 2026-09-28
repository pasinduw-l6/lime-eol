import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActionStatus, CommStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CompleteEnvironmentDto,
  CreateUpgradeActionDto,
  UpdateUpgradeActionDto,
} from './dto/upgrade-action.dto';

const MS_PER_DAY = 86_400_000;

/**
 * What the team intends to do about a deadline, and whether it happened.
 *
 * The part worth having is the second half. A ticket system will happily show
 * "done" while production still runs the old version; this holds the plan and
 * the recorded change side by side, so the claim can be checked against the
 * estate rather than believed.
 */
@Injectable()
export class UpgradeActionsService {
  constructor(private readonly prisma: PrismaService) {}

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
        plannedDate: toDate(input.plannedDate),
        status: (input.status ?? 'PLANNED') as ActionStatus,
        customerComm: (input.customerComm ?? 'NOT_REQUIRED') as CommStatus,
        customerCommNotes: input.customerCommNotes ?? null,
        remarks: input.remarks ?? null,
        deployments: {
          create: input.deploymentIds.map((deploymentId) => ({ deploymentId })),
        },
      },
      include: ACTION_INCLUDE,
    });

    return this.toDto(action);
  }

  async update(id: string, input: UpdateUpgradeActionDto) {
    await this.findOne(id);

    // Sent whole rather than as a delta: the picker knows the final list, and
    // two people editing coverage at once should not interleave into a set
    // neither of them chose.
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
        plannedDate: input.plannedDate ? toDate(input.plannedDate) : undefined,
        completedDate: input.completedDate ? toDate(input.completedDate) : undefined,
        status: input.status as ActionStatus | undefined,
        customerComm: input.customerComm as CommStatus | undefined,
        customerCommNotes: input.customerCommNotes,
        remarks: input.remarks,
      },
      include: ACTION_INCLUDE,
    });

    return this.toDto(action);
  }

  /**
   * Marks one environment done.
   *
   * Per environment rather than per action: a rollout reaches DEV weeks before
   * PROD, and "in progress" cannot say which is left. The action completes on
   * its own once every environment has.
   */
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

  /**
   * Whether the estate actually moved.
   *
   * For each environment an action covers, looks for a recorded change of that
   * technology onto the target cycle. This is what separates "somebody ticked
   * a box" from "production is on the new version".
   */
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

      // Either the exact version planned, or anything in a newer cycle — an
      // upgrade that overshot the target still satisfies the intent.
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
      /** The estate agrees this environment moved. */
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
      /// Mirrored from Jira by the issue-tracker sync. Carried here so a
      /// board of twenty plans draws from one request rather than twenty.
      jiraStatusCategory: action.jiraStatusCategory,
      jiraSubtaskDone: action.jiraSubtaskDone,
      jiraSubtaskTotal: action.jiraSubtaskTotal,
      customerComm: action.customerComm,
      customerCommNotes: action.customerCommNotes,
      remarks: action.remarks,
      environments,
      progress: { done, total: environments.length },
      /**
       * Marked complete with nothing recorded against it. The finding no
       * ticket system can produce, because it does not know what is deployed.
       */
      unverifiedCompletion:
        done > 0 && environments.some((e) => e.completedAt !== null && !e.verified),
      /** The plan itself finishes after support ends. */
      planTooLate:
        plannedDate !== null &&
        eolDate !== null &&
        plannedDate.getTime() > eolDate.getTime(),
      createdAt: action.createdAt.toISOString(),
    };
  }
}

const ACTION_INCLUDE = {
  cycle: { include: { technology: true } },
  assignee: true,
  team: true,
  deployments: {
    include: { deployment: { include: { project: true, customer: true } } },
  },
} as const;

type ActionRow = Awaited<
  ReturnType<PrismaService['upgradeAction']['findUniqueOrThrow']>
> & {
  cycle: { technologyId: string; technology: { name: string }; cycle: string; eolDate: Date | null; id: string };
  assignee: { id: string; displayName: string | null; email: string } | null;
  team: { id: string; name: string } | null;
  deployments: {
    deploymentId: string;
    completedAt: Date | null;
    deployment: {
      environment: string;
      projectId: string | null;
      project: { name: string } | null;
      customer: { name: string };
    };
  }[];
};

/**
 * What the state actually is, rather than what someone selected.
 *
 * Progress and dates are facts; a dropdown anyone can set to "Completed" is
 * not. Only PLANNED and DEFERRED survive as genuine human decisions.
 */
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

function toDate(value?: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function isoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
