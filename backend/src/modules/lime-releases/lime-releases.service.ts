import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseVersion } from '../../lifecycle/version.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLimeReleaseDto, UpdateLimeReleaseDto } from './lime-releases.dto';

const LIME = 'Lime';
const SUPPORT_YEARS = 4;

@Injectable()
export class LimeReleasesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const lime = await this.limeTechnology();
    const cycles = await this.prisma.technologyCycle.findMany({
      where: { technologyId: lime.id },
      include: { versions: { include: { deploymentOverrides: { where: { deployment: { archivedAt: null } } } } } },
    });
    const releases = await this.prisma.limeVersion.findMany({
      include: {
        components: {
          include: { techVersion: { include: { cycle: { include: { technology: true } } } } },
        },
      },
    });
    const projects = await this.prisma.project.findMany({
      where: { archivedAt: null },
      select: { name: true, limeVersion: true },
    });

    return cycles
      .map((cycle) => {
        const release = releases.find((r) => r.versionNumber === cycle.cycle);
        const environments = cycle.versions.reduce((n, v) => n + v.deploymentOverrides.length, 0);
        return {
          id: cycle.id,
          version: cycle.cycle,
          releaseDate: iso(cycle.releaseDate),
          supportEnd: iso(cycle.eolDate),
          notes: cycle.notes,
          environments,
          projects: projects.filter((p) => p.limeVersion === cycle.cycle).map((p) => p.name),
          compatibility: (release?.components ?? [])
            .map((c) => ({
              techVersionId: c.techVersionId,
              technology: c.techVersion.cycle.technology.name,
              version: c.techVersion.fullVersion,
            }))
            .sort((a, b) => a.technology.localeCompare(b.technology) || a.version.localeCompare(b.version)),
        };
      })
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  }

  async options() {
    const technologies = await this.prisma.technology.findMany({
      where: { archivedAt: null, name: { not: LIME } },
      orderBy: { name: 'asc' },
      include: { cycles: { include: { versions: true } } },
    });
    return technologies
      .map((t) => ({
        technology: t.name,
        versions: t.cycles
          .flatMap((c) => c.versions.map((v) => ({ id: v.id, version: v.fullVersion, cycle: c.cycle })))
          .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true })),
      }))
      .filter((t) => t.versions.length > 0);
  }

  async create(input: CreateLimeReleaseDto) {
    const lime = await this.limeTechnology();
    const version = input.version.trim();

    if (await this.prisma.technologyCycle.findUnique({ where: { technologyId_cycle: { technologyId: lime.id, cycle: version } } })) {
      throw new ConflictException(`Lime ${version} already exists.`);
    }

    const release = toDate(input.releaseDate);
    const end = toDate(input.supportEnd) ?? (release ? addYears(release, SUPPORT_YEARS) : null);
    assertOrder(release, end);
    const parsed = parseVersion(version);

    await this.prisma.$transaction(async (tx) => {
      const cycle = await tx.technologyCycle.create({
        data: {
          technologyId: lime.id,
          cycle: version,
          releaseDate: release,
          eolDate: end,
          notes: input.notes?.trim() || null,
          eolSource: 'MANUAL',
        },
      });
      await tx.technologyVersion.create({
        data: {
          technologyCycleId: cycle.id,
          fullVersion: version,
          major: parsed.major,
          minor: parsed.minor,
          patch: parsed.patch,
        },
      });
      await tx.limeVersion.upsert({
        where: { versionNumber: version },
        update: { releaseDate: release, notes: input.notes?.trim() || null, archivedAt: null },
        create: { versionNumber: version, releaseDate: release, notes: input.notes?.trim() || null },
      });
    });

    return this.findOne(version);
  }

  async update(cycleId: string, input: UpdateLimeReleaseDto) {
    const cycle = await this.requireCycle(cycleId);
    const version = input.version?.trim() || cycle.cycle;

    if (version !== cycle.cycle) {
      const inUse = await this.prisma.project.count({ where: { limeVersion: cycle.cycle, archivedAt: null } });
      if (inUse > 0) {
        throw new ConflictException(`Lime ${cycle.cycle} is used by projects, so its number cannot change.`);
      }
    }

    const release = input.releaseDate === undefined ? cycle.releaseDate : toDate(input.releaseDate);
    const end = input.supportEnd === undefined ? cycle.eolDate : toDate(input.supportEnd);
    assertOrder(release, end);
    const notes = input.notes === undefined ? cycle.notes : input.notes?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      await tx.technologyCycle.update({
        where: { id: cycleId },
        data: { cycle: version, releaseDate: release, eolDate: end, notes, eolSource: 'MANUAL' },
      });
      const existing = await tx.limeVersion.findUnique({ where: { versionNumber: cycle.cycle } });
      if (existing) {
        await tx.limeVersion.update({
          where: { id: existing.id },
          data: { versionNumber: version, releaseDate: release, notes },
        });
      } else {
        await tx.limeVersion.create({ data: { versionNumber: version, releaseDate: release, notes } });
      }
    });

    return this.findOne(version);
  }

  async setCompatibility(cycleId: string, techVersionIds: string[]) {
    const cycle = await this.requireCycle(cycleId);
    const ids = [...new Set(techVersionIds)];

    const found = await this.prisma.technologyVersion.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      throw new BadRequestException('One of those versions is not in the registry.');
    }

    const release = await this.prisma.limeVersion.upsert({
      where: { versionNumber: cycle.cycle },
      update: {},
      create: { versionNumber: cycle.cycle, releaseDate: cycle.releaseDate, notes: cycle.notes },
    });

    await this.prisma.$transaction([
      this.prisma.limeVersionComponent.deleteMany({ where: { limeVersionId: release.id } }),
      this.prisma.limeVersionComponent.createMany({
        data: ids.map((techVersionId) => ({ limeVersionId: release.id, techVersionId })),
      }),
    ]);

    return this.findOne(cycle.cycle);
  }

  async remove(cycleId: string): Promise<void> {
    const cycle = await this.prisma.technologyCycle.findUnique({
      where: { id: cycleId },
      include: { versions: { include: { _count: { select: { deploymentOverrides: true, changesFrom: true, changesTo: true } } } } },
    });
    if (!cycle) throw new NotFoundException(`No Lime release "${cycleId}"`);

    const projects = await this.prisma.project.count({ where: { limeVersion: cycle.cycle } });
    const used = cycle.versions.some(
      (v) => v._count.deploymentOverrides + v._count.changesFrom + v._count.changesTo > 0,
    );
    if (projects > 0 || used) {
      throw new ConflictException(`Lime ${cycle.cycle} is in use or in the change history, so it cannot be deleted.`);
    }

    await this.prisma.$transaction([
      this.prisma.limeVersion.deleteMany({ where: { versionNumber: cycle.cycle } }),
      this.prisma.technologyVersion.deleteMany({ where: { technologyCycleId: cycleId } }),
      this.prisma.technologyCycle.delete({ where: { id: cycleId } }),
    ]);
  }

  private async findOne(version: string) {
    const all = await this.findAll();
    return all.find((r) => r.version === version);
  }

  private async requireCycle(cycleId: string) {
    const lime = await this.limeTechnology();
    const cycle = await this.prisma.technologyCycle.findFirst({ where: { id: cycleId, technologyId: lime.id } });
    if (!cycle) throw new NotFoundException(`No Lime release "${cycleId}"`);
    return cycle;
  }

  private limeTechnology() {
    return this.prisma.technology.upsert({
      where: { name: LIME },
      update: {},
      create: {
        name: LIME,
        componentType: 'FRAMEWORK',
        scope: 'APPLICATION',
        vendor: 'LinearSix',
        cycleRule: 'MAJOR_MINOR',
        notes: 'Our own product. Versions are tracked to know what each customer runs.',
      },
    });
  }
}

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
}

function iso(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function addYears(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

function assertOrder(start: Date | null, end: Date | null): void {
  if (start && end && end.getTime() <= start.getTime()) {
    throw new BadRequestException('Support must end after the release date.');
  }
}
