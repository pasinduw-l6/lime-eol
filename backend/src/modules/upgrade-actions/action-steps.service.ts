import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StepStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateStepDto,
  LogTimeDto,
  ReorderStepsDto,
  UpdateStepDto,
} from './dto/step.dto';

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1440;

/**
 * The to-do list on an upgrade.
 *
 * Built for work that runs over weeks. A platform upgrade is picked up and put
 * down many times, so effort accumulates across stretches rather than being the
 * gap between one start and one finish — that would measure the calendar.
 */
@Injectable()
export class ActionStepsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actionId: string) {
    const steps = await this.prisma.upgradeActionStep.findMany({
      where: { upgradeActionId: actionId },
      orderBy: { position: 'asc' },
      include: { completedBy: true, assignee: true },
    });

    const firstOpen = steps.findIndex((s) => s.status !== StepStatus.DONE);
    return steps.map((step, index) => this.toDto(step, index === firstOpen));
  }

  async create(actionId: string, input: CreateStepDto) {
    const exists = await this.prisma.upgradeAction.findUnique({
      where: { id: actionId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`No upgrade action "${actionId}"`);
    }

    // Appended to the end, positions spaced so a later reorder has room
    // without rewriting every row.
    const last = await this.prisma.upgradeActionStep.findFirst({
      where: { upgradeActionId: actionId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    await this.prisma.upgradeActionStep.create({
      data: {
        upgradeActionId: actionId,
        title: input.title.trim(),
        description: input.description ?? null,
        position: (last?.position ?? 0) + 10,
        estimateMinutes: input.estimateMinutes ?? null,
        dueDate: toDate(input.dueDate),
        assigneeId: input.assigneeId ?? null,
      },
    });

    return this.list(actionId);
  }

  async update(actionId: string, stepId: string, input: UpdateStepDto) {
    await this.prisma.upgradeActionStep.update({
      where: { id: stepId },
      data: {
        title: input.title?.trim(),
        description: input.description,
        estimateMinutes: input.estimateMinutes,
        dueDate: input.dueDate === undefined ? undefined : toDate(input.dueDate),
        assigneeId: input.assigneeId,
      },
    });

    return this.list(actionId);
  }

  /** Starts the clock on a stretch of work. */
  async start(actionId: string, stepId: string) {
    const step = await this.load(stepId);

    if (step.startedAt) {
      throw new BadRequestException('That step is already running.');
    }

    await this.prisma.upgradeActionStep.update({
      where: { id: stepId },
      data: {
        startedAt: new Date(),
        status: StepStatus.IN_PROGRESS,
        blockedReason: null,
      },
    });

    return this.list(actionId);
  }

  /**
   * Stops the clock and banks what that stretch took.
   *
   * Several steps may run at once. Long upgrades genuinely overlap — waiting on
   * a customer window while preparing the next environment — and refusing that
   * would only teach people to leave the clock off.
   */
  async pause(actionId: string, stepId: string) {
    const step = await this.load(stepId);

    await this.prisma.upgradeActionStep.update({
      where: { id: stepId },
      data: {
        spentMinutes: step.spentMinutes + elapsedSince(step.startedAt),
        startedAt: null,
        status: StepStatus.TODO,
      },
    });

    return this.list(actionId);
  }

  /** Records effort that happened away from the clock. */
  async logTime(actionId: string, stepId: string, input: LogTimeDto) {
    const step = await this.load(stepId);

    await this.prisma.upgradeActionStep.update({
      where: { id: stepId },
      data: { spentMinutes: Math.max(0, step.spentMinutes + input.minutes) },
    });

    return this.list(actionId);
  }

  /** Marks a step as waiting on something outside the team's control. */
  async block(actionId: string, stepId: string, reason: string) {
    const step = await this.load(stepId);

    await this.prisma.upgradeActionStep.update({
      where: { id: stepId },
      data: {
        // Banked first: time spent before hitting the blocker still counts.
        spentMinutes: step.spentMinutes + elapsedSince(step.startedAt),
        startedAt: null,
        status: StepStatus.BLOCKED,
        blockedReason: reason.trim() || 'No reason given',
      },
    });

    return this.list(actionId);
  }

  async complete(actionId: string, stepId: string, actorId?: string) {
    const step = await this.load(stepId);

    await this.prisma.upgradeActionStep.update({
      where: { id: stepId },
      data: {
        spentMinutes: step.spentMinutes + elapsedSince(step.startedAt),
        startedAt: null,
        completedAt: new Date(),
        completedById: actorId ?? null,
        status: StepStatus.DONE,
        blockedReason: null,
      },
    });

    return this.list(actionId);
  }

  /** Puts a finished step back on the list, keeping the effort already logged. */
  async reopen(actionId: string, stepId: string) {
    await this.prisma.upgradeActionStep.update({
      where: { id: stepId },
      data: {
        completedAt: null,
        completedById: null,
        status: StepStatus.TODO,
      },
    });

    return this.list(actionId);
  }

  async reorder(actionId: string, input: ReorderStepsDto) {
    await this.prisma.$transaction(
      input.stepIds.map((id, index) =>
        this.prisma.upgradeActionStep.update({
          where: { id },
          data: { position: (index + 1) * 10 },
        }),
      ),
    );

    return this.list(actionId);
  }

  async remove(actionId: string, stepId: string) {
    await this.prisma.upgradeActionStep.delete({ where: { id: stepId } });
    return this.list(actionId);
  }

  private async load(stepId: string) {
    const step = await this.prisma.upgradeActionStep.findUnique({
      where: { id: stepId },
    });
    if (!step) {
      throw new NotFoundException('No such step.');
    }
    return step;
  }

  private toDto(step: StepRow, isNext: boolean) {
    // What is on the clock right now, so a running step shows a live total
    // rather than the figure banked at the last pause.
    const running = elapsedSince(step.startedAt);
    const spent = step.spentMinutes + running;

    const due = step.dueDate;
    const overdue =
      due !== null && step.status !== StepStatus.DONE && due < startOfToday();

    return {
      id: step.id,
      title: step.title,
      description: step.description,
      position: step.position,
      status: step.status,
      estimateMinutes: step.estimateMinutes,
      spentMinutes: spent,
      /** Over the estimate, with an estimate to be over. */
      overEstimate:
        step.estimateMinutes !== null && spent > step.estimateMinutes,
      startedAt: step.startedAt?.toISOString() ?? null,
      running: step.startedAt !== null,
      dueDate: isoDate(due),
      overdue,
      assignee: step.assignee
        ? {
            id: step.assignee.id,
            name: step.assignee.displayName ?? step.assignee.email,
          }
        : null,
      blockedReason: step.blockedReason,
      completedAt: step.completedAt?.toISOString() ?? null,
      completedBy: step.completedBy
        ? (step.completedBy.displayName ?? step.completedBy.email)
        : null,
      /** The first thing not yet done — where someone picks up. */
      isNext,
    };
  }
}

/** Whole minutes on the clock since a stretch began, or none if it is stopped. */
function elapsedSince(startedAt: Date | null): number {
  if (!startedAt) {
    return 0;
  }
  return Math.max(0, Math.round((Date.now() - startedAt.getTime()) / MS_PER_MINUTE));
}

function startOfToday(): Date {
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

/** Exported for the renderer: weeks and days, not four-digit minute counts. */
export function humanEffort(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  if (minutes < MINUTES_PER_DAY) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  }

  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const hours = Math.round((minutes % MINUTES_PER_DAY) / 60);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

type StepRow = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  status: StepStatus;
  estimateMinutes: number | null;
  spentMinutes: number;
  startedAt: Date | null;
  dueDate: Date | null;
  blockedReason: string | null;
  completedAt: Date | null;
  completedBy: { displayName: string | null; email: string } | null;
  assignee: { id: string; displayName: string | null; email: string } | null;
};
