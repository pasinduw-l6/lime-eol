import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ComponentChangeType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { compareVersions, deriveCycle, parseVersion } from '../../lifecycle/version.util';
import { ChangeComponentDto, ComponentChangeDto } from './dto/change-component.dto';

/**
 * Changing what an environment runs, and remembering that it changed.
 *
 * The write and the history entry happen in one transaction: an environment
 * whose recorded state moved without a matching history row would be worse
 * than no history at all.
 */
@Injectable()
export class DeploymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async changeComponent(
    deploymentId: string,
    input: ChangeComponentDto,
  ): Promise<ComponentChangeDto> {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
    });
    if (!deployment) {
      throw new NotFoundException(`No environment "${deploymentId}"`);
    }

    const technology = await this.prisma.technology.findUnique({
      where: { name: input.technology },
      include: { cycles: { include: { versions: true } } },
    });
    if (!technology) {
      throw new NotFoundException(
        `"${input.technology}" is not in the registry. Add it there first.`,
      );
    }

    const toVersion = input.toVersion.trim();

    // The cycle a version belongs to must already be registered: creating one
    // silently would invent lifecycle dates nobody verified.
    const cycleName = deriveCycle(toVersion, technology.cycleRule);
    const cycle = technology.cycles.find((c) => c.cycle === cycleName);
    if (!cycle) {
      throw new BadRequestException(
        `${technology.name} ${toVersion} belongs to cycle ${cycleName}, which is not in the registry. Add that cycle first so its end-of-life date is known.`,
      );
    }

    // Reuse the version row if we already know it; otherwise record it.
    const parsed = parseVersion(toVersion);
    const target =
      cycle.versions.find((v) => v.fullVersion === toVersion) ??
      (await this.prisma.technologyVersion.create({
        data: {
          technologyCycleId: cycle.id,
          fullVersion: toVersion,
          major: parsed.major,
          minor: parsed.minor,
          patch: parsed.patch,
        },
      }));

    const current = await this.prisma.deploymentComponent.findFirst({
      where: {
        deploymentId,
        techVersion: { cycle: { technologyId: technology.id } },
      },
      include: { techVersion: true },
    });

    if (current?.techVersionId === target.id) {
      throw new BadRequestException(
        `${technology.name} on this environment is already ${toVersion}.`,
      );
    }

    const changeType: ComponentChangeType = !current
      ? 'INSTALL'
      : compareVersions(current.techVersion.fullVersion, toVersion) < 0
        ? 'UPGRADE'
        : 'DOWNGRADE';

    const effectiveAt = new Date(
      `${input.effectiveAt ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
    );

    const change = await this.prisma.$transaction(async (tx) => {
      if (current) {
        await tx.deploymentComponent.delete({
          where: {
            deploymentId_techVersionId: {
              deploymentId,
              techVersionId: current.techVersionId,
            },
          },
        });
      }

      await tx.deploymentComponent.create({
        data: { deploymentId, techVersionId: target.id },
      });

      return tx.componentChange.create({
        data: {
          deploymentId,
          technologyId: technology.id,
          fromVersionId: current?.techVersionId ?? null,
          toVersionId: target.id,
          fromVersion: current?.techVersion.fullVersion ?? null,
          toVersion,
          changeType,
          effectiveAt,
          note: input.note,
        },
        include: { technology: true, recordedBy: true },
      });
    });

    return toDto(change);
  }

  async history(deploymentId: string): Promise<ComponentChangeDto[]> {
    const changes = await this.prisma.componentChange.findMany({
      where: { deploymentId },
      orderBy: [{ effectiveAt: 'desc' }, { recordedAt: 'desc' }],
      include: { technology: true, recordedBy: true },
    });

    return changes.map(toDto);
  }

  /** Versions on offer for a technology, newest cycle first. */
  async versionsFor(technologyName: string) {
    const technology = await this.prisma.technology.findUnique({
      where: { name: technologyName },
      include: {
        cycles: {
          orderBy: { eolDate: 'desc' },
          include: { versions: { orderBy: [{ major: 'desc' }, { minor: 'desc' }] } },
        },
      },
    });

    if (!technology) {
      throw new NotFoundException(`"${technologyName}" is not in the registry`);
    }

    return technology.cycles.map((cycle) => ({
      cycle: cycle.cycle,
      eolDate: cycle.eolDate?.toISOString().slice(0, 10) ?? null,
      latestPatch: cycle.latestPatch,
      versions: cycle.versions.map((v) => v.fullVersion),
    }));
  }
}

type ChangeRow = Prisma.ComponentChangeGetPayload<{
  include: { technology: true; recordedBy: true };
}>;

function toDto(change: ChangeRow): ComponentChangeDto {
  return {
    id: change.id,
    technology: change.technology.name,
    fromVersion: change.fromVersion,
    toVersion: change.toVersion,
    changeType: change.changeType,
    effectiveAt: change.effectiveAt.toISOString().slice(0, 10),
    recordedAt: change.recordedAt.toISOString(),
    recordedBy: change.recordedBy?.displayName ?? null,
    note: change.note,
  };
}
