import { EolRelease } from '../ports/eol-data-source.port';
import {
  findReleaseForCycle,
  mapReleaseToVersionLifecycle,
  selectEolDate,
  toDate,
} from './release-to-version.mapper';

const release: EolRelease = {
  cycle: '24',
  label: '24 (LTS)',
  codename: null,
  releaseDate: '2025-05-06',
  isLts: true,
  ltsFrom: '2025-10-28',
  eoasFrom: '2026-10-20',
  eolFrom: '2028-04-30',
  eoesFrom: null,
  isMaintained: true,
  latest: { name: '24.21.0', date: '2026-09-08', link: null },
};

describe('selectEolDate', () => {
  it('uses security support end for eol', () => {
    expect(selectEolDate(release, 'eol')).toBe('2028-04-30');
  });

  it('uses active support end for eoas', () => {
    expect(selectEolDate(release, 'eoas')).toBe('2026-10-20');
  });

  it('falls back to eol when a product has no extended support', () => {
    expect(selectEolDate(release, 'eoes')).toBe('2028-04-30');
  });

  it('prefers extended support when the product offers it', () => {
    expect(selectEolDate({ ...release, eoesFrom: '2031-04-30' }, 'eoes')).toBe(
      '2031-04-30',
    );
  });
});

describe('toDate', () => {
  it('anchors date-only values at UTC midnight so the local timezone cannot shift them', () => {
    expect(toDate('2028-04-30')?.toISOString()).toBe('2028-04-30T00:00:00.000Z');
  });

  it('returns null for missing or unparseable values', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate('')).toBeNull();
    expect(toDate('not-a-date')).toBeNull();
  });
});

describe('mapReleaseToVersionLifecycle', () => {
  it('maps a release onto the registry fields', () => {
    const mapped = mapReleaseToVersionLifecycle(release, 'eol');

    expect(mapped).toEqual({
      cycle: '24',
      releaseDate: new Date('2025-05-06T00:00:00.000Z'),
      eolDate: new Date('2028-04-30T00:00:00.000Z'),
      activeSupportEnd: new Date('2026-10-20T00:00:00.000Z'),
      isLts: true,
      latestSupported: '24.21.0',
    });
  });

  it('keeps nulls when a cycle has no dates yet', () => {
    const upcoming: EolRelease = {
      ...release,
      cycle: '27',
      releaseDate: null,
      eolFrom: null,
      eoasFrom: null,
      latest: null,
    };

    const mapped = mapReleaseToVersionLifecycle(upcoming);

    expect(mapped.eolDate).toBeNull();
    expect(mapped.releaseDate).toBeNull();
    expect(mapped.latestSupported).toBeNull();
  });
});

describe('findReleaseForCycle', () => {
  it('matches on the cycle identifier', () => {
    expect(findReleaseForCycle([release], '24')).toBe(release);
  });

  it('returns undefined when the cycle is not published', () => {
    expect(findReleaseForCycle([release], '18')).toBeUndefined();
  });
});
