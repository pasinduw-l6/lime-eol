import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EOL_DATA_SOURCE,
  EolDataSource,
} from '../eol-sync/ports/eol-data-source.port';
import { CreateTechnologyDto } from './dto/create-technology.dto';

const MS_PER_DAY = 86_400_000;

/**
 * The registry: technologies and their support cycles.
 *
 * Registering a technology pulls its published cycles in the same call. A
 * technology with no cycles cannot be deployed anywhere — `changeComponent`
 * refuses a version whose cycle has no end-of-life date — so importing later
 * would leave the registry holding entries nobody can use.
 */
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

  /**
   * Registers a technology, with its cycles when the source publishes them.
   *
   * Creation succeeds even if the import does not: an unreachable source is a
   * temporary condition, and the nightly sync will fill the cycles in. The
   * response says how many arrived so the caller can tell the difference.
   */
  async create(input: CreateTechnologyDto) {
    const existing = await this.prisma.technology.findUnique({
      where: { name: input.name },
    });
    if (existing) {
      throw new ConflictException(`"${input.name}" is already in the registry.`);
    }

    const technology = await this.prisma.technology.create({
      data: {
        name: input.name,
        componentType: input.componentType,
        vendor: input.vendor ?? null,
        eolSlug: input.eolSlug ?? null,
        cycleRule: input.cycleRule ?? 'MAJOR_MINOR',
        notes: input.notes ?? null,
      },
    });

    if (input.eolSlug) {
      await this.importCycles(technology.id, input.eolSlug);
    }

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

  /**
   * Products the lifecycle source knows about, for picking the right slug.
   *
   * Engineers know the product, not its slug — "Red Hat Enterprise Linux" is
   * `rhel` — so the slug is chosen from the source's own list rather than typed
   * and silently mismatched.
   */
  async searchSource(query: string) {
    const term = query.trim().toLowerCase();
    const products = await this.eol.listProducts();

    const registered = new Set(
      (
        await this.prisma.technology.findMany({
          where: { eolSlug: { not: null } },
          select: { eolSlug: true },
        })
      ).map((t) => t.eolSlug),
    );

    return products
      .filter(
        (product) =>
          !term ||
          product.slug.includes(term) ||
          product.label.toLowerCase().includes(term) ||
          product.aliases.some((alias) => alias.toLowerCase().includes(term)),
      )
      .slice(0, 40)
      .map((product) => ({
        slug: product.slug,
        label: product.label,
        category: product.category,
        /** Already registered — the UI shows it rather than offering it twice. */
        registered: registered.has(product.slug),
      }));
  }

  /** Every cycle the source publishes for a slug, with its real dates. */
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
      // Registration still stands; the nightly sync will pick the cycles up.
      this.logger.warn(
        `Could not import cycles for "${slug}": ${(error as Error).message}`,
      );
    }
  }

  private toDto(technology: {
    id: string;
    name: string;
    componentType: string;
    vendor: string | null;
    eolSlug: string | null;
    cycleRule: string;
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
      vendor: technology.vendor,
      eolSlug: technology.eolSlug,
      cycleRule: technology.cycleRule,
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

function isoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function toDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}
