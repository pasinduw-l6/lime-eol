import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseVersion } from '../../lifecycle/version.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EOL_DATA_SOURCE,
  EolDataSource,
} from '../eol-sync/ports/eol-data-source.port';
import { CreateTechnologyDto } from './dto/create-technology.dto';
import { CreateCycleDto, UpdateCycleDto } from './dto/cycle.dto';
import { UpdateTechnologyDto } from './dto/update-technology.dto';
import {
  iconFor,
  suggestComponentType,
  suggestCycleRule,
} from './product-type.util';

const MS_PER_DAY = 86_400_000;

@Injectable()
export class TechnologiesService {
  private readonly logger = new Logger(TechnologiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EOL_DATA_SOURCE) private readonly eol: EolDataSource,
  ) {}

  async findAll() {
    const technologies = await this.prisma.technology.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
      include: {
        cycles: {
          orderBy: { eolDate: 'asc' },
          include: { versions: { orderBy: [{ major: 'desc' }, { minor: 'desc' }] } },
        },
      },
    });

    return technologies.map((technology) => this.toDto(technology));
  }

  async findOne(id: string) {
    const technology = await this.prisma.technology.findFirst({
      where: { id, archivedAt: null },
      include: {
        cycles: {
          orderBy: { eolDate: 'asc' },
          include: { versions: { orderBy: [{ major: 'desc' }, { minor: 'desc' }] } },
        },
      },
    });
    if (!technology) {
      throw new NotFoundException(`No technology "${id}"`);
    }
    return this.toDto(technology);
  }

  async update(id: string, input: UpdateTechnologyDto) {
    await this.findOne(id);

    if (input.name) {
      const clash = await this.prisma.technology.findFirst({
        where: { name: input.name, id: { not: id } },
      });
      if (clash) {
        throw new ConflictException(`${input.name} is already in the registry.`);
      }
    }

    await this.prisma.technology.update({
      where: { id },
      data: {
        name: input.name,
        componentType: input.componentType,
        scope: input.scope,
        vendor: input.vendor === undefined ? undefined : input.vendor.trim() || null,
        cycleRule: input.cycleRule,
        notes: input.notes === undefined ? undefined : input.notes.trim() || null,
      },
    });

    return this.findOne(id);
  }

  async archive(id: string): Promise<void> {
    const technology = await this.findOne(id);
    const users = await this.environmentsUsing({ cycle: { technologyId: id } });

    if (users.length > 0) {
      throw new ConflictException(
        `${technology.name} is still installed on ${users.join(', ')}. Remove it there first.`,
      );
    }

    await this.prisma.technology.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async createCycle(technologyId: string, input: CreateCycleDto) {
    await this.findOne(technologyId);
    const name = input.cycle.trim();

    const clash = await this.prisma.technologyCycle.findUnique({
      where: { technologyId_cycle: { technologyId, cycle: name } },
    });
    if (clash) {
      throw new ConflictException(`Cycle ${name} already exists.`);
    }

    const cycle = await this.prisma.technologyCycle.create({
      data: {
        technologyId,
        cycle: name,
        label: input.label?.trim() || null,
        releaseDate: toDate(input.releaseDate ?? null),
        activeSupportEnd: toDate(input.activeSupportEnd ?? null),
        eolDate: toDate(input.eolDate ?? null),
        isLts: input.isLts ?? false,
        isMaintained: input.isMaintained ?? true,
        latestPatch: input.latestPatch?.trim() || null,
        notes: input.notes?.trim() || null,
        eolSource: 'MANUAL',
      },
    });

    await this.syncVersions(cycle.id, input.versions ?? []);
    return this.findOne(technologyId);
  }

  async updateCycle(cycleId: string, input: UpdateCycleDto) {
    const cycle = await this.prisma.technologyCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) {
      throw new NotFoundException(`No cycle "${cycleId}"`);
    }

    const name = input.cycle?.trim();
    if (name && name !== cycle.cycle) {
      const clash = await this.prisma.technologyCycle.findUnique({
        where: { technologyId_cycle: { technologyId: cycle.technologyId, cycle: name } },
      });
      if (clash) {
        throw new ConflictException(`Cycle ${name} already exists.`);
      }
    }

    const dates = {
      releaseDate: input.releaseDate === undefined ? undefined : toDate(input.releaseDate),
      activeSupportEnd:
        input.activeSupportEnd === undefined ? undefined : toDate(input.activeSupportEnd),
      eolDate: input.eolDate === undefined ? undefined : toDate(input.eolDate),
    };

    const history = (Object.keys(dates) as (keyof typeof dates)[])
      .filter((field) => dates[field] !== undefined)
      .filter((field) => isoDate(cycle[field]) !== isoDate(dates[field] ?? null))
      .map((field) => ({
        technologyCycleId: cycle.id,
        field,
        oldValue: isoDate(cycle[field]),
        newValue: isoDate(dates[field] ?? null),
        source: 'MANUAL' as const,
      }));

    await this.prisma.$transaction([
      this.prisma.technologyCycle.update({
        where: { id: cycleId },
        data: {
          cycle: name,
          label: input.label === undefined ? undefined : input.label?.trim() || null,
          ...dates,
          isLts: input.isLts,
          isMaintained: input.isMaintained,
          latestPatch:
            input.latestPatch === undefined ? undefined : input.latestPatch?.trim() || null,
          notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
          eolSource: history.length > 0 ? 'MANUAL' : undefined,
        },
      }),
      this.prisma.technologyCycleHistory.createMany({ data: history }),
    ]);

    if (input.versions) {
      await this.syncVersions(cycleId, input.versions);
    }

    return this.findOne(cycle.technologyId);
  }

  async deleteCycle(cycleId: string): Promise<void> {
    const cycle = await this.prisma.technologyCycle.findUnique({
      where: { id: cycleId },
      include: { _count: { select: { upgradeActions: true } } },
    });
    if (!cycle) {
      throw new NotFoundException(`No cycle "${cycleId}"`);
    }

    const users = await this.environmentsUsing({ technologyCycleId: cycleId });
    if (users.length > 0) {
      throw new ConflictException(
        `Cycle ${cycle.cycle} is still installed on ${users.join(', ')}. Remove it there first.`,
      );
    }
    if (cycle._count.upgradeActions > 0) {
      throw new ConflictException(`Cycle ${cycle.cycle} has upgrade plans. Delete those first.`);
    }

    const used = await this.prisma.componentChange.count({
      where: {
        OR: [
          { fromVersion_: { technologyCycleId: cycleId } },
          { toVersion_: { technologyCycleId: cycleId } },
        ],
      },
    });
    if (used > 0) {
      throw new ConflictException(
        `Cycle ${cycle.cycle} appears in the change history, so it cannot be deleted.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.technologyVersion.deleteMany({ where: { technologyCycleId: cycleId } }),
      this.prisma.technologyCycle.delete({ where: { id: cycleId } }),
    ]);
  }

  private async environmentsUsing(
    version: Prisma.TechnologyVersionWhereInput,
  ): Promise<string[]> {
    const rows = await this.prisma.deploymentComponent.findMany({
      where: { techVersion: version, deployment: { archivedAt: null } },
      include: { deployment: true },
    });
    return [...new Set(rows.map((r) => r.deployment.name))];
  }

  private async syncVersions(cycleId: string, wanted: string[]): Promise<void> {
    const list = [...new Set(wanted.map((v) => v.trim()).filter(Boolean))];
    const existing = await this.prisma.technologyVersion.findMany({
      where: { technologyCycleId: cycleId },
      include: { _count: { select: { deploymentOverrides: true, changesFrom: true, changesTo: true } } },
    });

    for (const version of list) {
      if (existing.some((v) => v.fullVersion === version)) continue;
      const parsed = parseVersion(version);
      await this.prisma.technologyVersion.create({
        data: {
          technologyCycleId: cycleId,
          fullVersion: version,
          major: parsed.major,
          minor: parsed.minor,
          patch: parsed.patch,
        },
      });
    }

    const removable = existing.filter(
      (v) =>
        !list.includes(v.fullVersion) &&
        v._count.deploymentOverrides === 0 &&
        v._count.changesFrom === 0 &&
        v._count.changesTo === 0,
    );
    if (removable.length > 0) {
      await this.prisma.technologyVersion.deleteMany({
        where: { id: { in: removable.map((v) => v.id) } },
      });
    }
  }

  async create(input: CreateTechnologyDto) {
    if (input.internal) {
      return this.createInternal(input);
    }

    if (!input.slug) {
      throw new BadRequestException(
        'Pick a product from the catalogue, or pass internal: true with a name.',
      );
    }

    const product = await this.eol.getProduct(input.slug).catch(() => null);

    if (!product) {
      throw new BadRequestException(
        `"${input.slug}" is not a product endoflife.date publishes. Pick one from the catalogue.`,
      );
    }

    const name = input.name?.trim() || product.label;

    const clash = await this.prisma.technology.findFirst({
      where: { OR: [{ name }, { eolSlug: input.slug }] },
    });
    if (clash) {
      throw new ConflictException(
        clash.eolSlug === input.slug
          ? `${clash.name} already tracks ${input.slug}.`
          : `"${name}" is already in the registry.`,
      );
    }

    const icon = iconFor(product.slug);

    const componentType =
      input.componentType ??
      suggestComponentType({
        slug: product.slug,
        category: product.category,
        tags: product.tags,
      });

    const technology = await this.prisma.technology.create({
      data: {
        name,
        componentType,
        scope: scopeFor(componentType),
        vendor: input.vendor ?? null,
        eolSlug: product.slug,
        cycleRule:
          input.cycleRule ??
          suggestCycleRule(product.releases.map((release) => release.cycle)),
        referenceUrl: product.htmlUrl,
        iconSlug: icon?.iconSlug ?? null,
        iconColour: icon?.iconColour ?? null,
        notes: input.notes ?? null,
      },
    });

    await this.importCycles(technology.id, product.slug);

    const created = await this.prisma.technology.findUniqueOrThrow({
      where: { id: technology.id },
      include: {
        cycles: {
          orderBy: { eolDate: 'asc' },
          include: { versions: { orderBy: [{ major: 'desc' }, { minor: 'desc' }] } },
        },
      },
    });

    return this.toDto(created);
  }

  private async createInternal(input: CreateTechnologyDto) {
    const name = input.name?.trim();

    if (!name) {
      throw new BadRequestException('An internal technology needs a name.');
    }

    const existing = await this.prisma.technology.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException(`"${name}" is already in the registry.`);
    }

    const technology = await this.prisma.technology.create({
      data: {
        name,
        componentType: input.componentType ?? 'OTHER',
        scope: scopeFor(input.componentType ?? 'OTHER'),
        vendor: input.vendor ?? null,
        eolSlug: null,
        cycleRule: input.cycleRule ?? 'MAJOR_MINOR',
        notes: input.notes ?? 'Internal — no published end-of-life dates.',
      },
      include: {
        cycles: {
          orderBy: { eolDate: 'asc' },
          include: { versions: { orderBy: [{ major: 'desc' }, { minor: 'desc' }] } },
        },
      },
    });

    return this.toDto(technology);
  }

  async catalogue() {
    const products = await this.eol.listProducts();

    const registered = new Map(
      (
        await this.prisma.technology.findMany({
          where: { eolSlug: { not: null }, archivedAt: null },
          select: { eolSlug: true, name: true },
        })
      ).map((t) => [t.eolSlug, t.name]),
    );

    return products
      .map((product) => {
        const icon = iconFor(product.slug);
        return {
          slug: product.slug,
          label: product.label,
          category: product.category,
          tags: product.tags,
          aliases: product.aliases,
          iconSlug: icon?.iconSlug ?? null,
          iconColour: icon?.iconColour ?? null,
          suggestedType: suggestComponentType({
            slug: product.slug,
            category: product.category,
            tags: product.tags,
          }),
          registeredAs: registered.get(product.slug) ?? null,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private async importCycles(technologyId: string, slug: string): Promise<void> {
    try {
      const product = await this.eol.getProduct(slug);

      await this.prisma.technologyCycle.createMany({
        data: product.releases.map((release) => ({
          technologyId,
          cycle: release.cycle,
          label: release.label,
          releaseDate: toDate(release.releaseDate),
          eolDate: toDate(release.eolFrom),
          activeSupportEnd: toDate(release.eoasFrom),
          isLts: release.isLts,
          isMaintained: release.isMaintained,
          latestPatch: release.latest?.name ?? null,
          eolSource: 'API' as const,
          lastSyncedAt: new Date(),
          notes: 'Imported when the technology was registered.',
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      this.logger.warn(
        `Could not import cycles for "${slug}": ${(error as Error).message}`,
      );
    }
  }

  private toDto(technology: {
    id: string;
    name: string;
    componentType: string;
    scope: string;
    vendor: string | null;
    eolSlug: string | null;
    cycleRule: string;
    iconSlug: string | null;
    iconColour: string | null;
    notes: string | null;
    cycles: {
      id: string;
      cycle: string;
      label: string | null;
      releaseDate: Date | null;
      eolDate: Date | null;
      activeSupportEnd: Date | null;
      isLts: boolean;
      isMaintained: boolean;
      latestPatch: string | null;
      eolSource: string;
      notes: string | null;
      versions: { fullVersion: string }[];
    }[];
  }) {
    const now = new Date();
    const todayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );

    return {
      id: technology.id,
      name: technology.name,
      componentType: technology.componentType,
      scope: technology.scope,
      vendor: technology.vendor,
      eolSlug: technology.eolSlug,
      cycleRule: technology.cycleRule,
      iconSlug: technology.iconSlug ?? iconOf(technology.eolSlug)?.iconSlug ?? null,
      iconColour:
        technology.iconColour ?? iconOf(technology.eolSlug)?.iconColour ?? null,
      notes: technology.notes,
      cycles: technology.cycles.map((cycle) => ({
        id: cycle.id,
        cycle: cycle.cycle,
        label: cycle.label,
        releaseDate: isoDate(cycle.releaseDate),
        eolDate: isoDate(cycle.eolDate),
        activeSupportEnd: isoDate(cycle.activeSupportEnd),
        isLts: cycle.isLts,
        isMaintained: cycle.isMaintained,
        latestPatch: cycle.latestPatch,
        eolSource: cycle.eolSource,
        notes: cycle.notes,
        daysToEol: cycle.eolDate
          ? Math.round((cycle.eolDate.getTime() - todayUtc) / MS_PER_DAY)
          : null,
        versions: cycle.versions.map((v) => v.fullVersion),
      })),
    };
  }
}

function scopeFor(componentType: string): 'INFRASTRUCTURE' | 'APPLICATION' {
  return ['RUNTIME', 'FRAMEWORK', 'LIBRARY'].includes(componentType) ? 'APPLICATION' : 'INFRASTRUCTURE';
}

function iconOf(slug: string | null) {
  return slug ? iconFor(slug) : null;
}

function isoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function toDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}
