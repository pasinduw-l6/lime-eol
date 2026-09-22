import {
  ComponentType,
  CycleRule,
  EolField,
  EolSource,
  PrismaClient,
} from '@prisma/client';
import { deriveCycle, parseVersion } from '../../src/lifecycle/version.util';

/**
 * The technologies the Lime Platform actually runs on.
 *
 * Every slug and every date below was verified against endoflife.date on
 * 2026-09-22. The nightly sync keeps API-sourced cycles current; cycles marked
 * MANUAL are ones the source no longer publishes, and the sync must never
 * overwrite them.
 */
interface CycleSeed {
  cycle: string;
  label?: string;
  releaseDate?: string;
  eolDate?: string;
  activeSupportEnd?: string;
  isLts?: boolean;
  isMaintained?: boolean;
  latestPatch?: string;
  eolSource?: EolSource;
  notes?: string;
  /** Builds actually deployed somewhere. */
  versions: string[];
}

interface TechnologySeed {
  name: string;
  eolSlug: string | null;
  componentType: ComponentType;
  cycleRule: CycleRule;
  eolField?: EolField;
  vendor?: string;
  cycles: CycleSeed[];
}

const TECHNOLOGIES: TechnologySeed[] = [
  {
    name: 'Red Hat Enterprise Linux',
    eolSlug: 'rhel',
    componentType: 'OS',
    cycleRule: 'MAJOR',
    vendor: 'Red Hat',
    cycles: [
      {
        cycle: '7',
        label: '7 (ELS)',
        releaseDate: '2014-06-10',
        activeSupportEnd: '2019-08-06',
        eolDate: '2024-06-30',
        isLts: true,
        isMaintained: true,
        latestPatch: '7.9',
        versions: ['7.4'],
        notes: 'Maipo. Extended life-cycle support only.',
      },
      {
        cycle: '9',
        releaseDate: '2022-05-18',
        activeSupportEnd: '2027-05-31',
        eolDate: '2032-05-31',
        latestPatch: '9.8',
        versions: [],
      },
    ],
  },
  {
    name: 'Docker Engine',
    eolSlug: 'docker-engine',
    componentType: 'CONTAINER',
    cycleRule: 'MAJOR_MINOR',
    vendor: 'Docker Inc.',
    cycles: [
      {
        cycle: '18.09',
        releaseDate: '2018-11-08',
        eolDate: '2019-08-22',
        isMaintained: false,
        latestPatch: '18.09.9',
        versions: ['18.09.4'],
      },
      {
        cycle: '28.0',
        releaseDate: '2025-02-20',
        eolDate: '2026-05-13',
        isMaintained: false,
        latestPatch: '28.5.2',
        versions: [],
      },
    ],
  },
  {
    name: 'Kubernetes',
    eolSlug: 'kubernetes',
    componentType: 'ORCHESTRATION',
    cycleRule: 'MAJOR_MINOR',
    vendor: 'CNCF',
    cycles: [
      {
        // endoflife.date no longer publishes cycles this old, so the dates are
        // entered by hand from the Kubernetes release history and marked
        // MANUAL: the sync must not clear them.
        cycle: '1.14',
        releaseDate: '2019-03-25',
        eolDate: '2019-12-11',
        isMaintained: false,
        latestPatch: '1.14.10',
        eolSource: 'MANUAL',
        notes: 'Dropped from endoflife.date; dates from the Kubernetes release history.',
        versions: ['1.14.1'],
      },
      {
        cycle: '1.35',
        releaseDate: '2025-12-17',
        activeSupportEnd: '2026-12-28',
        eolDate: '2027-02-28',
        latestPatch: '1.35.8',
        versions: [],
      },
    ],
  },
  {
    name: 'MongoDB',
    eolSlug: 'mongodb',
    componentType: 'DATABASE',
    cycleRule: 'MAJOR_MINOR',
    vendor: 'MongoDB Inc.',
    cycles: [
      {
        cycle: '8.0',
        releaseDate: '2024-10-31',
        eolDate: '2029-10-31',
        latestPatch: '8.0.32',
        versions: ['8.0'],
      },
    ],
  },
];

function toDate(value?: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function seedTechnologies(prisma: PrismaClient): Promise<void> {
  let cycleCount = 0;
  let versionCount = 0;

  for (const tech of TECHNOLOGIES) {
    const technology = await prisma.technology.upsert({
      where: { name: tech.name },
      update: {},
      create: {
        name: tech.name,
        eolSlug: tech.eolSlug,
        componentType: tech.componentType,
        cycleRule: tech.cycleRule,
        eolField: tech.eolField ?? 'EOL',
        vendor: tech.vendor,
        referenceUrl: tech.eolSlug ? `https://endoflife.date/${tech.eolSlug}` : null,
      },
    });

    for (const cycleSeed of tech.cycles) {
      const cycle = await prisma.technologyCycle.upsert({
        where: {
          technologyId_cycle: { technologyId: technology.id, cycle: cycleSeed.cycle },
        },
        update: {},
        create: {
          technologyId: technology.id,
          cycle: cycleSeed.cycle,
          label: cycleSeed.label ?? cycleSeed.cycle,
          releaseDate: toDate(cycleSeed.releaseDate),
          eolDate: toDate(cycleSeed.eolDate),
          activeSupportEnd: toDate(cycleSeed.activeSupportEnd),
          isLts: cycleSeed.isLts ?? false,
          isMaintained: cycleSeed.isMaintained ?? true,
          latestPatch: cycleSeed.latestPatch,
          eolSource: cycleSeed.eolSource ?? 'API',
          lastSyncedAt: cycleSeed.eolSource === 'MANUAL' ? null : new Date(),
          notes: cycleSeed.notes,
        },
      });
      cycleCount++;

      for (const fullVersion of cycleSeed.versions) {
        // The parser that derives a cycle also fills the sort columns, so seed
        // data exercises the same code path as the API.
        const derived = deriveCycle(fullVersion, tech.cycleRule);
        if (derived !== cycleSeed.cycle) {
          throw new Error(
            `Seed error: ${tech.name} ${fullVersion} derives cycle ${derived}, expected ${cycleSeed.cycle}`,
          );
        }

        const parsed = parseVersion(fullVersion);
        await prisma.technologyVersion.upsert({
          where: {
            technologyCycleId_fullVersion: {
              technologyCycleId: cycle.id,
              fullVersion,
            },
          },
          update: {},
          create: {
            technologyCycleId: cycle.id,
            fullVersion,
            major: parsed.major,
            minor: parsed.minor,
            patch: parsed.patch,
          },
        });
        versionCount++;
      }
    }
  }

  console.log(
    `  technologies: ${TECHNOLOGIES.length}, cycles: ${cycleCount}, versions: ${versionCount}`,
  );
}
