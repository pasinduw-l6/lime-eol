import { coverageOf, currentAgreement, statusOf, termsFor } from './agreement.util';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const today = d('2026-10-09');

describe('statusOf', () => {
  it.each([
    [null, 'NONE'],
    [{ startDate: d('2025-01-01'), endDate: d('2029-01-01') }, 'ACTIVE'],
    [{ startDate: d('2025-01-01'), endDate: null }, 'ACTIVE'],
    [{ startDate: d('2025-01-01'), endDate: d('2026-12-01') }, 'EXPIRING'],
    [{ startDate: d('2020-01-01'), endDate: d('2026-10-01') }, 'EXPIRED'],
    [{ startDate: d('2027-01-01'), endDate: d('2030-01-01') }, 'UPCOMING'],
  ])('%o is %s', (agreement, status) => {
    expect(statusOf(agreement, today)).toBe(status);
  });
});

describe('currentAgreement', () => {
  const old = { id: 'old', startDate: d('2019-01-01'), endDate: d('2024-01-01') };
  const live = { id: 'live', startDate: d('2024-01-02'), endDate: d('2029-01-01') };
  const next = { id: 'next', startDate: d('2029-01-02'), endDate: d('2034-01-01') };

  it('prefers the agreement running today', () => {
    expect(currentAgreement([old, next, live], today)?.id).toBe('live');
  });

  it('falls back to the most recent one that has started', () => {
    expect(currentAgreement([old, next], today)?.id).toBe('old');
  });

  it('uses the next one when none has started', () => {
    expect(currentAgreement([next], today)?.id).toBe('next');
  });

  it('is null without agreements', () => {
    expect(currentAgreement([], today)).toBeNull();
  });
});

describe('coverageOf, following the EOL handling process', () => {
  const sub = { type: 'SUBSCRIPTION' as const, infrastructure: null, startDate: d('2024-03-01'), endDate: d('2029-03-01') };
  const lic = { type: 'LICENSE' as const, infrastructure: 'QUOTED' as const, startDate: null, endDate: null };

  it('includes infrastructure and routes application dependencies through Lime releases for a subscription', () => {
    expect(coverageOf(sub, today)).toEqual({ infrastructure: 'INCLUDED', application: 'VIA_LIME' });
  });

  it('ends infrastructure support once the subscription period is over', () => {
    expect(coverageOf({ ...sub, endDate: d('2026-01-01') }, today).infrastructure).toBe('ENDED');
  });

  it('assesses application dependencies separately for a license', () => {
    expect(coverageOf(lic, today)).toEqual({ infrastructure: 'QUOTED', application: 'SEPARATE' });
  });

  it('follows the license agreement for infrastructure', () => {
    expect(coverageOf({ ...lic, infrastructure: 'INCLUDED' }, today).infrastructure).toBe('INCLUDED');
  });

  it('treats a customer without an agreement as quoted', () => {
    expect(coverageOf(null, today)).toEqual({ infrastructure: 'QUOTED', application: 'SEPARATE' });
  });
});

describe('termsFor', () => {
  it.each([
    ['INFRASTRUCTURE', { infrastructure: 'INCLUDED', application: 'VIA_LIME' }, 'INCLUDED'],
    ['APPLICATION', { infrastructure: 'INCLUDED', application: 'VIA_LIME' }, 'VIA_LIME'],
    ['INFRASTRUCTURE', { infrastructure: 'ENDED', application: 'VIA_LIME' }, 'TERM_ENDED'],
    ['INFRASTRUCTURE', { infrastructure: 'QUOTED', application: 'SEPARATE' }, 'QUOTE'],
    ['APPLICATION', { infrastructure: 'INCLUDED', application: 'SEPARATE' }, 'QUOTE'],
  ] as const)('%s under %o is %s', (scope, coverage, terms) => {
    expect(termsFor(scope, coverage)).toBe(terms);
  });
});
