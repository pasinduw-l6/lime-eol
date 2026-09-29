import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { EolLookupService } from './eol-lookup.service';

export interface SyncResult {
  technologies: number;
  cyclesUpdated: number;
  changes: { technology: string; cycle: string; field: string; from: string | null; to: string | null }[];
  unmatched: { technology: string; cycles: string[] }[];
  failures: { technology: string; reason: string }[];
}

/**
 * Refreshes end-of-life dates from endoflife.date.
 *
 * importCycles already writes dates, but only once, when a technology is first
 * registered, and with skipDuplicates - so a cycle that already exists is
 * skipped forever. Recording a deployment creates exactly such a cycle: adding
 * Kubernetes 1.31 to a project makes the row, and nothing ever goes back to say
 * when 1.31 loses support. This updates rather than inserts, which is the whole
 * difference.
 *
 * It also writes technology_cycle_history, which is what lets anyone notice
 * that a vendor moved a date - a warning no schedule can produce, because
 * nothing about the passage of time predicts it.
 */
@Injectable()
export class EolSyncService {
  private readonly logger = new Logger(EolSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: EolLookupService,
  ) {}

  async run(): Promise<SyncResult> {
    const technologies = await this.prisma.technology.findMany({
      where: { eolSlug: { not: null }, archivedAt: null },
      orderBy: { name: 'asc' },
    });

    const result: SyncResult = {
      technologies: technologies.length,
      cyclesUpdated: 0,
      changes: [],
      unmatched: [],
      failures: [],
    };

    for (const technology of technologies) {
      const slug = technology.eolSlug as string;

      let releases;
      try {
        // Prisma spells the enum EOL/EOAS/EOES; the lookup service uses the
        // lowercase names endoflife.date itself uses.
        const product = await this.lookup.getProduct(
          slug,
          technology.eolField.toLowerCase() as 'eol' | 'eoas' | 'eoes',
        );
        releases = product.releases;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'lookup failed';
        this.logger.warn(`${technology.name}: ${reason}`);
        result.failures.push({ technology: technology.name, reason });
        continue;
      }

      // Only cycles already in the registry are touched. Importing every cycle
      // the vendor publishes would add RHEL 4 through 10 for a customer on 8,
      // and bury the estate in rows nobody runs.
      const existing = await this.prisma.technologyCycle.findMany({
        where: { technologyId: technology.id },
      });

      for (const cycle of existing) {
        const release = releases.find((r) => r.cycle === cycle.cycle);

        if (!release) {
          continue;
        }

        const eolDate = toDate(release.eolDate);
        const previousEol = cycle.eolDate;

        // Written before the update, so the detector that announces a moved
        // date has something to read. Only real changes are recorded - an
        // unchanged sync would otherwise fill the history with noise.
        if (!sameDay(previousEol, eolDate)) {
          await this.prisma.technologyCycleHistory.create({
            data: {
              technologyCycleId: cycle.id,
              field: 'eolDate',
              oldValue: previousEol ? iso(previousEol) : null,
              newValue: eolDate ? iso(eolDate) : null,
              source: 'API',
            },
          });

          result.changes.push({
            technology: technology.name,
            cycle: cycle.cycle,
            field: 'eolDate',
            from: previousEol ? iso(previousEol) : null,
            to: eolDate ? iso(eolDate) : null,
          });
        }

        if (cycle.isMaintained !== release.isMaintained) {
          await this.prisma.technologyCycleHistory.create({
            data: {
              technologyCycleId: cycle.id,
              field: 'isMaintained',
              oldValue: String(cycle.isMaintained),
              newValue: String(release.isMaintained),
              source: 'API',
            },
          });

          result.changes.push({
            technology: technology.name,
            cycle: cycle.cycle,
            field: 'isMaintained',
            from: String(cycle.isMaintained),
            to: String(release.isMaintained),
          });
        }

        await this.prisma.technologyCycle.update({
          where: { id: cycle.id },
          data: {
            label: release.label,
            releaseDate: toDate(release.releaseDate),
            eolDate,
            activeSupportEnd: toDate(release.activeSupportEnd),
            isLts: release.isLts,
            isMaintained: release.isMaintained,
            latestPatch: release.latestSupported,
            eolSource: 'API',
            lastSyncedAt: new Date(),
          },
        });

        result.cyclesUpdated += 1;
      }

      // A cycle we hold that upstream has never heard of is worth naming: it
      // is usually a mistyped version, or one written 18.9 where the vendor
      // calls it 18.09 - and it will silently never have a date.
      const unmatched = existing
        .filter((cycle) => !releases.some((r) => r.cycle === cycle.cycle))
        .map((cycle) => cycle.cycle);

      if (unmatched.length > 0) {
        result.unmatched.push({ technology: technology.name, cycles: unmatched });
      }
    }

    this.logger.log(
      `Synced ${result.cyclesUpdated} cycles across ${result.technologies} technologies, ` +
        `${result.changes.length} changed`,
    );

    return result;
  }
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  return iso(a) === iso(b);
}
