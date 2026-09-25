import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStepDto, ReorderStepsDto, UpdateStepDto } from './dto/step.dto';

const MS_PER_MINUTE = 60_000;

/**
 * The to-do list on an upgrade.
 *
 * Worked through in order, one at a time. Timings are recorded as they happen
 * rather than typed afterwards — startedAt and completedAt give the real
 * duration, which is the only honest basis for estimating the next upgrade of
 * the same thing.
 */
@Injectable()
export class ActionStepsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actionId: string) {
    const steps = await this.prisma.upgradeActionStep.findMany({
      where: { upgradeActionId: actionId },
      orderBy: { position: 'asc' },
      include: { completedBy: true },
    });

    return steps.map((step, index) => this.toDto(step, steps, index));
  }

  async create(actionId: string, input: CreateStepDto) {
    const exists = await this.prisma.upgradeAction.findUnique({
      where: { id: actionId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`No upgrade action "${actionId}"`);
    }

    // Appended to the end. Positions are spaced so a later reorder has room
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
        position: (last?.position ?? 0) + 10,
        estimateMinutes: input.estimateMinutes ?? null,
        note: input.note ?? null,
      },
    });

    return this.list(actionId);
  }

  async update(actionId: string, stepId: string, input: UpdateStepDto) {
    await this.prisma.upgradeActionStep.update({
      where: { id: stepId },
      data: {
        title: input.title?.trim(),
        estimateMinutes: input.estimateMinutes,
        note: input.note,
      },
    });

    return this.list(actionId);
  }

  /**
   * Starts the clock on a step.
   *
   * Only one runs at a time: a to-do list worked through one by one cannot have
   * two things in progress, and allowing it would make every recorded duration
   * meaningless.
   */
  async start(actionId: string, stepId: string) {
    const running = await this.prisma.upgradeActionStep.findFirst({
      where: {
        upgradeActionId: actionId,
        startedAt: { not: null },
        completedAt: null,
        id: { not: stepId },
      },
    });

    if (running) {
      throw new BadRequestException(
        `"${running.title}" is still in progress. Finish it before starting another.`,
      );
    }

    await this.prisma.upgradeActionStep.update({
      where: { id: stepId },
      data: { startedAt: new Date(), completedAt: null },
    });

    return this.list(actionId);
  }

  /** Ticks a step off, timing it from when it was started. */
  async complete(actionId: string, stepId: string, actorId?: string) {
    const step = await this.prisma.upgradeActionStep.findUnique({
      where: { id: stepId },
    });
    if (!step) {
      throw new NotFoundException('No such step.');
    }

    await this.prisma.upgradeActionStep.update({
      where: { id: stepId },
      data: {
        // Ticked without being started, the duration is unknown rather than
        // zero — so the start time is left alone and the DTO reports null.
        completedAt: new Date(),
        completedById: actorId ?? null,
      },
    });

    return this.list(actionId);
  }

  /** Puts a completed step back on the list. */
  async reopen(actionId: string, stepId: string) {
    await this.prisma.upgradeActionStep.update({
      where: { id: stepId },
      data: { completedAt: null, completedById: null },
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

  private toDto(step: StepRow, all: StepRow[], index: number) {
    const actualMinutes =
      step.startedAt && step.completedAt
        ? Math.max(
            1,
            Math.round(
              (step.completedAt.getTime() - step.startedAt.getTime()) / MS_PER_MINUTE,
            ),
          )
        : null;

    // The next thing to do: the first unfinished step. Everything after it is
    // waiting, which is what "one by one" means on screen.
    const firstOpen = all.findIndex((s) => s.completedAt === null);

    return {
      id: step.id,
      title: step.title,
      position: step.position,
      estimateMinutes: step.estimateMinutes,
      startedAt: step.startedAt?.toISOString() ?? null,
      completedAt: step.completedAt?.toISOString() ?? null,
      completedBy: step.completedBy
        ? (step.completedBy.displayName ?? step.completedBy.email)
        : null,
      note: step.note,
      actualMinutes,
      /** Running now. */
      inProgress: step.startedAt !== null && step.completedAt === null,
      /** The one to pick up next. */
      isNext: index === firstOpen,
    };
  }
}

type StepRow = {
  id: string;
  title: string;
  position: number;
  estimateMinutes: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  note: string | null;
  completedBy: { displayName: string | null; email: string } | null;
};
