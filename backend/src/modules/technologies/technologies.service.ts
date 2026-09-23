import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EOL_DATA_SOURCE,
  EolDataSource,
} from '../eol-sync/ports/eol-data-source.port';
import { CreateTechnologyDto } from './dto/create-technology.dto';
import {
  iconFor,
  suggestComponentType,
  suggestCycleRule,
} from './product-type.util';

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
   * Registers one of the products endoflife.date publishes.
   *
   * The slug is the input; name, component type, cycle rule and logo are all
   * read from the product. A technology invented here would have no published
   * lifecycle dates, which is the blind spot this tool exists to remove — so
   * the catalogue is the only way in, and its cycles are imported in the same
   * call.
   */
  async create(input: CreateTechnologyDto) {
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

    const technology = await this.prisma.technology.create({
      data: {
        name,
        componentType:
          input.componentType ??
          suggestComponentType({
            slug: product.slug,
            category: product.category,
            tags: product.tags,
          }),
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

  /**
   * The whole endoflife.date catalogue, which is what you may add.
   *
   * Returned in full rather than searched server-side: it is a few hundred
   * products, so the picker filters as you type without a request per keystroke.
   * Each row carries its logo and a suggested component type, so choosing a
   * product fills the form instead of asking the engineer to restate it.
   */
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
          /** Already registered — shown as such rather than offered twice. */
          registeredAs: registered.get(product.slug) ?? null,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
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
      vendor: technology.vendor,
      eolSlug: technology.eolSlug,
      cycleRule: technology.cycleRule,
      // Falls back to the catalogue mark when the row predates the icon columns.
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

/** The catalogue's mark for a slug, for rows registered before icons were stored. */
function iconOf(slug: string | null) {
  return slug ? iconFor(slug) : null;
}

function isoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function toDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}
