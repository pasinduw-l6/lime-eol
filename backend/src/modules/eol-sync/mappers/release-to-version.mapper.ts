import { EolField, EolRelease } from '../ports/eol-data-source.port';

/**
 * The lifecycle fields a TechnologyVersion takes from the data source.
 * Matches the API-owned columns in the Prisma model (Phase 2).
 */
export interface MappedVersionLifecycle {
  cycle: string;
  releaseDate: Date | null;
  eolDate: Date | null;
  activeSupportEnd: Date | null;
  isLts: boolean;
  latestSupported: string | null;
}

/**
 * Picks the date a technology treats as its end of life.
 *
 * Which phase counts differs per product: for most it is `eol`, but a product
 * with paid extended support may track `eoes`, and a team that will not run
 * security-only builds may track `eoas`. Technology.eolField decides.
 */
export function selectEolDate(
  release: EolRelease,
  eolField: EolField,
): string | null {
  switch (eolField) {
    case 'eoas':
      return release.eoasFrom;
    case 'eoes':
      return release.eoesFrom ?? release.eolFrom;
    case 'eol':
    default:
      return release.eolFrom;
  }
}

export function toDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  // Date-only values are anchored at UTC midnight so the stored DATE does not
  // shift when the container runs in Asia/Colombo.
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function mapReleaseToVersionLifecycle(
  release: EolRelease,
  eolField: EolField = 'eol',
): MappedVersionLifecycle {
  return {
    cycle: release.cycle,
    releaseDate: toDate(release.releaseDate),
    eolDate: toDate(selectEolDate(release, eolField)),
    activeSupportEnd: toDate(release.eoasFrom),
    isLts: release.isLts,
    latestSupported: release.latest?.name ?? null,
  };
}

/** Finds the release matching a registered version's cycle. */
export function findReleaseForCycle(
  releases: EolRelease[],
  cycle: string,
): EolRelease | undefined {
  return releases.find((release) => release.cycle === cycle);
}
