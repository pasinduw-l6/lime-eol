import { CycleRule } from '@prisma/client';

export interface ParsedVersion {
  major: number;
  minor: number | null;
  patch: number | null;
}

const VERSION_PATTERN = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/i;

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

export function deriveCycle(raw: string, rule: CycleRule): string {
  const match = VERSION_PATTERN.exec(raw);

  if (!match) {
    throw new Error(`Cannot parse version "${raw}"`);
  }

  if (rule === 'MAJOR_MINOR') {
    return `${match[1]}.${match[2] ?? '0'}`;
  }

  return match[1];
}

export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);

  return (
    left.major - right.major ||
    (left.minor ?? 0) - (right.minor ?? 0) ||
    (left.patch ?? 0) - (right.patch ?? 0)
  );
}
