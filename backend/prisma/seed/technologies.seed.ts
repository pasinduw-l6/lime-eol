import {
  ComponentType,
  CycleRule,
  EolField,
  PrismaClient,
} from '@prisma/client';
import { deriveCycle, parseVersion } from '../../src/lifecycle/version.util';

/**
 * The technologies the Lime Platform runs on.
 *
 * Every slug was verified against endoflife.date on 2026-09-17. Cycle dates
 * below are the real published values on that date; the nightly sync keeps
 * them current, so they are a starting point rather than a source of truth.
 * Versions are the specific builds we run.
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
  /** Builds of this cycle that are actually deployed somewhere. */
  versions: string[];
}

interface TechnologySeed {
  name: string;
  eolSlug: string;
  componentType: ComponentType;
  cycleRule: CycleRule;
  eolField?: EolField;
  vendor?: string;
  cycles: CycleSeed[];
}

const TECHNOLOGIES: TechnologySeed[] = [
  {
    name: 'MongoDB',
    eolSlug: 'mongodb',
    componentType: 'DATABASE',
    cycleRule: 'MAJOR_MINOR',
    vendor: 'MongoDB Inc.',
    cycles: [
      {
        cycle: '8.3',
        releaseDate: '2026-05-31',
        eolDate: '2029-10-31',
        latestPatch: '8.3.11',
        versions: ['8.3.11'],
      },
      {
        // Already past end of life — the registry should flag this loudly.
        cycle: '8.2',
        releaseDate: '2025-09-30',
        eolDate: '2026-07-31',
        isMaintained: false,
        latestPatch: '8.2.12',
        versions: ['8.2.12', '8.2.4'],
      },
    ],
  },
  {
    name: 'Node.js',
    eolSlug: 'nodejs',
    componentType: 'RUNTIME',
    cycleRule: 'MAJOR',
    vendor: 'OpenJS Foundation',
    cycles: [
      {
        cycle: '24',
        label: '24 (LTS)',
        releaseDate: '2025-05-06',
        eolDate: '2028-04-30',
        activeSupportEnd: '2026-10-20',
        isLts: true,
        latestPatch: '24.21.0',
        versions: ['24.21.0'],
      },
      {
        cycle: '25',
        releaseDate: '2025-10-15',
        eolDate: '2026-06-01',
        activeSupportEnd: '2026-04-01',
        isMaintained: false,
        latestPatch: '25.9.0',
        versions: ['25.9.0'],
      },
    ],
  },
  {
    name: 'Angular',
    eolSlug: 'angular',
    componentType: 'FRAMEWORK',
    cycleRule: 'MAJOR',
    vendor: 'Google',
    cycles: [
      {
        // Inside the 180-day window: this is what the dashboard exists for.
        cycle: '20',
        releaseDate: '2025-05-28',
        eolDate: '2026-11-28',
        activeSupportEnd: '2025-11-19',
        latestPatch: '20.3.31',
        versions: ['20.3.31'],
      },
      {
        cycle: '21',
        releaseDate: '2025-11-19',
        eolDate: '2027-06-30',
        activeSupportEnd: '2026-06-03',
        latestPatch: '21.2.23',
        versions: ['21.2.23'],
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
        cycle: '1.35',
        releaseDate: '2025-12-17',
        eolDate: '2027-02-28',
        activeSupportEnd: '2026-12-28',
        latestPatch: '1.35.8',
        versions: ['1.35.8'],
      },
    ],
  },
  {
    name: 'RHEL',
    eolSlug: 'rhel',
    componentType: 'OS',
    cycleRule: 'MAJOR',
    vendor: 'Red Hat',
    cycles: [
      {
        cycle: '9',
        releaseDate: '2022-05-18',
        eolDate: '2032-05-31',
        activeSupportEnd: '2027-05-31',
        latestPatch: '9.8',
        versions: ['9.8', '9.6'],
      },
    ],
  },
  {
    name: 'Docker Engine',
    eolSlug: 'docker-engine',
    componentType: 'CONTAINER',
    // Upstream changed scheme: older cycles are major.minor ('26.1'), current
    // ones are major ('27', '28'). MAJOR matches what is published today.
    // See docs/findings.md — derivation is a hint, the published cycle wins.
    cycleRule: 'MAJOR',
    vendor: 'Docker Inc.',
    cycles: [
      {
        cycle: '28',
        releaseDate: '2025-02-20',
        eolDate: '2026-05-13',
        isMaintained: false,
        latestPatch: '28.5.2',
        versions: ['28.5.2'],
      },
    ],
  },
  {
    name: 'Apache Kafka',
    eolSlug: 'apache-kafka',
    componentType: 'MESSAGING',
    cycleRule: 'MAJOR_MINOR',
    vendor: 'Apache Software Foundation',
    cycles: [
      {
        // Long past end of life: an upgrade action is seeded for this one.
        cycle: '3.8',
        releaseDate: '2024-07-26',
        eolDate: '2024-11-06',
        isMaintained: false,
        latestPatch: '3.8.1',
        versions: ['3.8.1'],
      },
    ],
  },
  {
    name: 'OpenSSL',
    eolSlug: 'openssl',
    componentType: 'LIBRARY',
    cycleRule: 'MAJOR_MINOR',
    cycles: [
      {
        // Under 90 days — the most urgent thing in the seeded registry.
        cycle: '3.6',
        releaseDate: '2025-10-01',
        eolDate: '2026-11-01',
        isMaintained: false,
        latestPatch: '3.6.4',
        versions: ['3.6.4'],
      },
      {
        cycle: '3.5',
        releaseDate: '2025-04-08',
        eolDate: '2030-04-08',
        isLts: true,
        latestPatch: '3.5.8',
        versions: ['3.5.8'],
      },
    ],
  },
  {
    name: 'PostgreSQL',
    eolSlug: 'postgresql',
    componentType: 'DATABASE',
    cycleRule: 'MAJOR',
    vendor: 'PostgreSQL Global Development Group',
    cycles: [
      {
        cycle: '16',
        releaseDate: '2023-09-14',
        eolDate: '2028-11-09',
        latestPatch: '16.15',
        versions: ['16.15'],
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
        referenceUrl: `https://endoflife.date/${tech.eolSlug}`,
      },
    });

    for (const cycleSeed of tech.cycles) {
      const cycle = await prisma.technologyCycle.upsert({
        where: {
          technologyId_cycle: {
            technologyId: technology.id,
            cycle: cycleSeed.cycle,
          },
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
          eolSource: 'API',
          lastSyncedAt: new Date(),
        },
      });
      cycleCount++;

      for (const fullVersion of cycleSeed.versions) {
        // The parser that derives the cycle also fills the sort columns,
        // so seeded data exercises the same code path as the API.
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
