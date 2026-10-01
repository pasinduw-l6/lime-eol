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
