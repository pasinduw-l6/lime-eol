import { EolField, EolRelease } from '../ports/eol-data-source.port';

export interface MappedVersionLifecycle {
  cycle: string;
  releaseDate: Date | null;
  eolDate: Date | null;
  activeSupportEnd: Date | null;
  isLts: boolean;
  latestSupported: string | null;
}

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

export function findReleaseForCycle(
  releases: EolRelease[],
  cycle: string,
): EolRelease | undefined {
  return releases.find((release) => release.cycle === cycle);
}
