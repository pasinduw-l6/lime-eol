import { CycleRule } from '@prisma/client';

export interface ParsedVersion {
  major: number;
  minor: number | null;
  patch: number | null;
}

const VERSION_PATTERN = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/i;

/**
 * Splits a version string into its numeric parts.
 *
 * Stored alongside the original string so versions sort numerically:
 * as text, '6.0.9' sorts after '6.0.14', which is wrong.
 *
 * Suffixes are ignored: '1.30.2-rc1' parses as 1.30.2.
 */
export function parseVersion(raw: string): ParsedVersion {
  const match = VERSION_PATTERN.exec(raw);

  if (!match) {
    throw new Error(`Cannot parse version "${raw}"`);
  }

  return {
    major: Number(match[1]),
    minor: match[2] !== undefined ? Number(match[2]) : null,
    patch: match[3] !== undefined ? Number(match[3]) : null,
  };
}

/**
 * Reduces a version to the support cycle the data source publishes dates for.
 *
 * MAJOR:       20.11.1 -> '20'    (Node.js, RHEL, Angular)
 * MAJOR_MINOR: 6.0.14  -> '6.0'   (MongoDB, Kubernetes, OpenSSL)
 */
export function deriveCycle(raw: string, rule: CycleRule): string {
  const match = VERSION_PATTERN.exec(raw);

  if (!match) {
    throw new Error(`Cannot parse version "${raw}"`);
  }

  // Built from the captured text, not from the parsed numbers: Docker ships
  // zero-padded minors (18.09, 19.03, 20.10), and rebuilding "09" from the
  // number 9 would produce a cycle that does not exist upstream.
  if (rule === 'MAJOR_MINOR') {
    return `${match[1]}.${match[2] ?? '0'}`;
  }

  return match[1];
}

/** Orders two versions numerically. Negative when a is older than b. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);

  return (
    left.major - right.major ||
    (left.minor ?? 0) - (right.minor ?? 0) ||
    (left.patch ?? 0) - (right.patch ?? 0)
  );
}
