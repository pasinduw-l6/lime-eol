import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ComponentChangeType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EOL_DATA_SOURCE, EolDataSource } from '../eol-sync/ports/eol-data-source.port';
import { compareVersions, deriveCycle, parseVersion } from '../../lifecycle/version.util';
import { ChangeComponentDto, ComponentChangeDto } from './dto/change-component.dto';
import { ChainEntry, hashEntry, verifyChain, VerificationResult } from './history.util';

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EOL_DATA_SOURCE) private readonly eol: EolDataSource,
  ) {}

  async changeComponent(
    deploymentId: string,
    input: ChangeComponentDto,
    actorId?: string,
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

    const cycleName = await this.resolveCycleName(
      toVersion,
      technology.cycleRule,
      technology.cycles.map((c) => c.cycle),
      technology.eolSlug,
    );
    const cycle =
      technology.cycles.find((c) => c.cycle === cycleName) ??
      (await this.importCycle(technology.id, technology.eolSlug, cycleName)) ??
      (technology.eolSlug === null
        ? await this.createInternalCycle(technology.id, cycleName)
        : null);

    if (!cycle) {
      throw new BadRequestException(
        `${technology.name} ${toVersion} belongs to cycle ${cycleName}, which is not in the registry and not published by the lifecycle source. Add that cycle by hand so its end-of-life date is known.`,
      );
    }

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
      const previous = await tx.componentChange.findFirst({
        where: { deploymentId },
        orderBy: { sequence: 'desc' },
      });

      const sequence = (previous?.sequence ?? 0) + 1;
      const hash = hashEntry(
        {
          deploymentId,
          fromVersion: current?.techVersion.fullVersion ?? null,
          toVersion,
          changeType,
          effectiveAt: effectiveAt.toISOString().slice(0, 10),
        },
        previous?.hash ?? null,
      );

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
          reason: input.reason ?? (current ? 'PLANNED_UPGRADE' : 'INITIAL_RECORD'),
          ticketRef: input.ticketRef,
          evidenceUrl: input.evidenceUrl,
          correctsId: input.correctsId,
          recordedById: actorId ?? null,
          sequence,
          hash,
          previousHash: previous?.hash ?? null,
        },
        include: { technology: true, recordedBy: true },
      });
    });

    return toDto(change);
  }

  private async resolveCycleName(
    version: string,
    rule: 'MAJOR' | 'MAJOR_MINOR',
    registered: string[],
    slug: string | null,
  ): Promise<string> {
    const candidates = new Set(registered);

    if (slug) {
      try {
        const product = await this.eol.getProduct(slug);
        product.releases.forEach((r) => candidates.add(r.cycle));
      } catch {
      }
    }

    const match = [...candidates]
      .filter((cycle) => version === cycle || version.startsWith(`${cycle}.`))
      .sort((a, b) => b.length - a.length)[0];

    return match ?? deriveCycle(version, rule);
  }

  private async createInternalCycle(technologyId: string, cycleName: string) {
    return this.prisma.technologyCycle.create({
      data: {
        technologyId,
        cycle: cycleName,
        label: cycleName,
        isLts: false,
        isMaintained: true,
        eolSource: 'MANUAL',
        notes: 'Internal release — recorded to track what is deployed.',
      },
      include: { versions: true },
    });
  }

  private async importCycle(
    technologyId: string,
    slug: string | null,
    cycleName: string,
  ) {
    if (!slug) {
      return null;
    }

    try {
      const release = await this.eol.getRelease(slug, cycleName);
      if (!release) {
        return null;
      }

      return await this.prisma.technologyCycle.create({
        data: {
          technologyId,
          cycle: release.cycle,
          label: release.label,
          releaseDate: toDate(release.releaseDate),
          eolDate: toDate(release.eolFrom),
          activeSupportEnd: toDate(release.eoasFrom),
          isLts: release.isLts,
          isMaintained: release.isMaintained,
          latestPatch: release.latest?.name ?? null,
          eolSource: 'API',
          lastSyncedAt: new Date(),
          notes: 'Registered when an environment moved onto it.',
        },
        include: { versions: true },
      });
    } catch {
      return null;
    }
  }

  async history(
    deploymentId: string,
    filters: { technology?: string; from?: string; to?: string; reason?: string } = {},
  ): Promise<ComponentChangeDto[]> {
    const changes = await this.prisma.componentChange.findMany({
      where: {
        deploymentId,
        technology: filters.technology ? { name: filters.technology } : undefined,
        reason: filters.reason ? (filters.reason as never) : undefined,
        effectiveAt: {
          gte: filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : undefined,
          lte: filters.to ? new Date(`${filters.to}T00:00:00.000Z`) : undefined,
        },
      },
      orderBy: [{ sequence: 'desc' }],
      include: { technology: true, recordedBy: true },
    });

    return changes.map(toDto);
  }

  async verify(deploymentId: string): Promise<VerificationResult> {
    const entries = await this.prisma.componentChange.findMany({
      where: { deploymentId },
      orderBy: { sequence: 'asc' },
    });

    return verifyChain(
      entries.map(
        (e): ChainEntry => ({
          id: e.id,
          sequence: e.sequence,
          hash: e.hash,
          previousHash: e.previousHash,
          deploymentId: e.deploymentId,
          fromVersion: e.fromVersion,
          toVersion: e.toVersion,
          changeType: e.changeType,
          effectiveAt: e.effectiveAt.toISOString().slice(0, 10),
        }),
      ),
    );
  }

  async historyCsv(deploymentId: string): Promise<string> {
    const changes = await this.history(deploymentId);
    const header = [
      'sequence',
      'effective_at',
      'recorded_at',
      'technology',
      'from_version',
      'to_version',
      'change_type',
      'reason',
      'ticket',
      'recorded_by',
      'note',
      'hash',
    ];

    const rows = changes.map((c) =>
      [
        c.sequence,
        c.effectiveAt,
        c.recordedAt,
        c.technology,
        c.fromVersion ?? '',
        c.toVersion ?? '',
        c.changeType,
        c.reason,
        c.ticketRef ?? '',
        c.recordedBy ?? '',
        c.note ?? '',
        c.hash,
      ].map(csvCell),
    );

    return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  async versionsFor(technologyName: string, currentVersion?: string) {
    const technology = await this.prisma.technology.findUnique({
      where: { name: technologyName },
      include: {
        cycles: {
          include: { versions: { orderBy: [{ major: 'desc' }, { minor: 'desc' }] } },
        },
      },
    });

    if (!technology) {
      throw new NotFoundException(`"${technologyName}" is not in the registry`);
    }

    const groups = new Map<
      string,
      { cycle: string; eolDate: string | null; registered: boolean; versions: Set<string> }
    >();

    const group = (cycle: string, eolDate: string | null, registered: boolean) => {
      const existing = groups.get(cycle);
      if (existing) {
        existing.registered ||= registered;
        existing.eolDate ??= eolDate;
        return existing;
      }
      const created = { cycle, eolDate, registered, versions: new Set<string>() };
      groups.set(cycle, created);
      return created;
    };

    for (const cycle of technology.cycles) {
      const entry = group(
        cycle.cycle,
        cycle.eolDate?.toISOString().slice(0, 10) ?? null,
        true,
      );
      cycle.versions.forEach((v) => entry.versions.add(v.fullVersion));
      if (cycle.latestPatch) {
        entry.versions.add(cycle.latestPatch);
      }
    }

    if (technology.eolSlug) {
      try {
        const product = await this.eol.getProduct(technology.eolSlug);
        for (const release of product.releases) {
          const entry = group(release.cycle, release.eolFrom, false);
          if (release.latest?.name) {
            entry.versions.add(release.latest.name);
          }
        }
      } catch {
      }
    }

    const newer = (candidate: string) =>
      !currentVersion || compareVersions(candidate, currentVersion) > 0;

    return [...groups.values()]
      .map((entry) => ({
        cycle: entry.cycle,
        eolDate: entry.eolDate,
        registered: entry.registered,
        versions: [...entry.versions]
          .filter(newer)
          .sort((a, b) => compareVersions(b, a)),
      }))
      .filter((entry) => entry.versions.length > 0)
      .sort((a, b) => (b.eolDate ?? '').localeCompare(a.eolDate ?? ''));
  }
}

type ChangeRow = Prisma.ComponentChangeGetPayload<{
  include: { technology: true; recordedBy: true };
}>;

function toDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function csvCell(value: string | number): string {
  const text = String(value);
  const needsQuoting = text.includes(',') || text.includes('"') || text.includes('\n');
  return needsQuoting ? `"${text.replace(/"/g, '""')}"` : text;
}

function toDto(change: ChangeRow): ComponentChangeDto {
  return {
    id: change.id,
    sequence: change.sequence,
    reason: change.reason,
    ticketRef: change.ticketRef,
    evidenceUrl: change.evidenceUrl,
    correctsId: change.correctsId,
    hash: change.hash,
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
