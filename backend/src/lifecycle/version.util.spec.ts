import { compareVersions, deriveCycle, parseVersion } from './version.util';

describe('parseVersion', () => {
  it.each([
    ['20.11.1', { major: 20, minor: 11, patch: 1 }],
    ['6.0.14', { major: 6, minor: 0, patch: 14 }],
    ['9.4', { major: 9, minor: 4, patch: null }],
    ['8', { major: 8, minor: null, patch: null }],
    ['v24.21.0', { major: 24, minor: 21, patch: 0 }],
    ['1.30.2-rc1', { major: 1, minor: 30, patch: 2 }],
    ['26.1.5', { major: 26, minor: 1, patch: 5 }],
  ])('parses %s', (input, expected) => {
    expect(parseVersion(input)).toEqual(expected);
  });

  it('rejects a string with no version in it', () => {
    expect(() => parseVersion('latest')).toThrow(/Cannot parse version/);
  });
});

describe('deriveCycle', () => {
  it.each([
    ['20.11.1', 'MAJOR', '20'],
    ['9.4', 'MAJOR', '9'],
    ['v24.21.0', 'MAJOR', '24'],
    ['6.0.14', 'MAJOR_MINOR', '6.0'],
    ['1.30.2', 'MAJOR_MINOR', '1.30'],
    ['3.6.4', 'MAJOR_MINOR', '3.6'],
  ])('reduces %s under %s to %s', (input, rule, expected) => {
    expect(deriveCycle(input, rule as never)).toBe(expected);
  });

  it('treats a missing minor as zero for major.minor products', () => {
    expect(deriveCycle('8', 'MAJOR_MINOR')).toBe('8.0');
  });

  it.each([
    ['18.09.4', '18.09'],
    ['19.03.15', '19.03'],
    ['20.10.24', '20.10'],
  ])('keeps a zero-padded minor: %s -> %s', (input, expected) => {
    // Docker's cycles are 18.09 and 19.03, not 18.9 and 19.3. Rebuilding the
    // string from parsed numbers would silently invent a cycle that upstream
    // has never published.
    expect(deriveCycle(input, 'MAJOR_MINOR')).toBe(expected);
  });
});

describe('compareVersions', () => {
  it('orders numerically, not as text', () => {
    // The reason major/minor/patch are stored as integers.
    expect(compareVersions('6.0.9', '6.0.14')).toBeLessThan(0);
    expect('6.0.9' < '6.0.14').toBe(false);
  });

  it('returns zero for equal versions', () => {
    expect(compareVersions('24.21.0', 'v24.21.0')).toBe(0);
  });

  it('treats a missing part as zero', () => {
    expect(compareVersions('8', '8.0.0')).toBe(0);
    expect(compareVersions('8.1', '8')).toBeGreaterThan(0);
  });
});
