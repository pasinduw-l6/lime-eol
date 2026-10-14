import { ProjectDto } from '../projects/dto/project-response.dto';

// Mirrors the PDF report page (frontend features/report/formal-report.ts) so both formats say the same thing.

export type Status = 'EOL' | 'NEAR' | 'SUPPORTED' | 'UNKNOWN';

export interface CycleFacts {
  releaseDate: string | null;
}

export interface Row {
  technology: string;
  version: string;
  kind: string;
  environments: string[];
  released: string | null;
  fullSupportEnds: string | null;
  endOfSupport: string | null;
  days: number | null;
  status: Status;
  newest: string | null;
}

export interface Bar {
  label: string;
  start: number;
  full: number;
  end: number;
  colour: string;
}

export interface Axis {
  from: number;
  to: number;
  years: number[];
  today: number;
}

export interface ReportSection {
  projectId: string;
  heading: string;
  bars: Bar[];
  groups: { status: Status; rows: Row[] }[];
}

const ENV_ORDER = ['DEV', 'UAT', 'PROD'];
const STATUS_ORDER: Status[] = ['EOL', 'NEAR', 'SUPPORTED', 'UNKNOWN'];

export const STATUS_INFO: Record<Status, { heading: string; meaning: string; colour: string }> = {
  EOL: {
    heading: 'Past end of support',
    meaning: 'The vendor no longer releases any fixes, including security fixes.',
    colour: '#b42318',
  },
  NEAR: {
    heading: 'Ending within 180 days',
    meaning: 'Vendor support ends within the next 180 days.',
    colour: '#b54708',
  },
  SUPPORTED: {
    heading: 'Supported',
    meaning: 'The vendor still releases fixes for these versions.',
    colour: '#067647',
  },
  UNKNOWN: {
    heading: 'No published end date',
    meaning: 'The vendor has not published an end-of-support date for these versions.',
    colour: '#475467',
  },
};

const KIND: Record<string, string> = {
  OS: 'Operating system',
  CONTAINER: 'Container runtime',
  ORCHESTRATION: 'Container platform',
  DATABASE: 'Database',
  MESSAGING: 'Messaging',
  RUNTIME: 'Runtime',
  FRAMEWORK: 'Framework',
  LIBRARY: 'Library',
  OTHER: 'Other',
};

export function rowsOf(
  project: ProjectDto,
  cycles: Map<string, CycleFacts>,
  newest: Map<string, string>,
): Row[] {
  const rows = new Map<string, Row>();
  for (const env of project.environments) {
    for (const c of env.components) {
      const key = `${c.technology}|${c.version}`;
      const existing = rows.get(key);
      if (existing) {
        existing.environments.push(env.environment);
        continue;
      }
      rows.set(key, {
        technology: c.technology,
        version: c.version,
        kind: c.technology === 'Lime' ? 'Lime platform' : (KIND[c.componentType] ?? c.componentType),
        environments: [env.environment],
        released: cycles.get(`${c.technology}|${c.cycle}`)?.releaseDate ?? null,
        fullSupportEnds: c.activeSupportEnd,
        endOfSupport: c.eolDate,
        days: c.daysToEol,
        status: toStatus(c.status),
        newest: newest.get(c.technology) ?? null,
      });
    }
  }
  for (const row of rows.values()) {
    row.environments.sort((a, b) => ENV_ORDER.indexOf(a) - ENV_ORDER.indexOf(b));
  }
  return [...rows.values()].sort(
    (a, b) =>
      (a.endOfSupport ?? '9999').localeCompare(b.endOfSupport ?? '9999') || a.technology.localeCompare(b.technology),
  );
}

function toStatus(value: string): Status {
  return (STATUS_ORDER as string[]).includes(value) ? (value as Status) : 'UNKNOWN';
}

export function axisFor(rows: Row[], asOf: Date): Axis {
  const now = asOf.getTime();
  const starts = rows.map((r) => r.released).filter((d): d is string => !!d).map(parse);
  const ends = rows.map((r) => r.endOfSupport).filter((d): d is string => !!d).map(parse);
  const firstYear = new Date(Math.min(now, ...starts)).getUTCFullYear();
  const lastYear = new Date(Math.max(now, ...ends)).getUTCFullYear() + 1;
  const step = lastYear - firstYear > 10 ? 2 : 1;
  const years: number[] = [];
  for (let y = firstYear; y <= lastYear; y += step) years.push(y);
  return { from: Date.UTC(firstYear, 0, 1), to: Date.UTC(lastYear, 0, 1), years, today: now };
}

export function sectionsFor(projects: ProjectDto[], allRows: Row[][], axis: Axis, everything: boolean): ReportSection[] {
  return projects.map((project, i) => {
    const rows = allRows[i];
    const bars = rows.map((r) => {
      const start = r.released ? parse(r.released) : axis.from;
      const end = r.endOfSupport ? parse(r.endOfSupport) : axis.to;
      const full = r.fullSupportEnds ? Math.min(parse(r.fullSupportEnds), end) : end;
      return { label: `${r.technology} ${r.version}`, start, full, end, colour: STATUS_INFO[r.status].colour };
    });
    const groups = STATUS_ORDER.map((status) => ({ status, rows: rows.filter((r) => r.status === status) })).filter(
      (g) => g.rows.length > 0,
    );
    const name = everything ? `${project.customer} · ${project.name}` : project.name;
    return { projectId: project.id, heading: `${name} (${project.code})`, bars, groups };
  });
}

export function story(r: Row, asOf: Date): string {
  const days = r.days;
  if (days === null || !r.endOfSupport) return 'The vendor has not published an end-of-support date';
  if (days <= 0) return `Without vendor fixes for ${span(-days)}`;
  const securityOnly = !!r.fullSupportEnds && parse(r.fullSupportEnds) < asOf.getTime();
  if (r.status === 'NEAR') {
    return securityOnly
      ? `Security fixes only since ${fmt(r.fullSupportEnds)} · all support ends in ${span(days)}`
      : `All support ends in ${span(days)}`;
  }
  return securityOnly
    ? `Security fixes only since ${fmt(r.fullSupportEnds)} · supported for ${span(days)}`
    : `Supported for ${span(days)}`;
}

export function span(days: number): string {
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`;
  const totalMonths = Math.round(days / 30.44);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const y = years ? `${years} year${years === 1 ? '' : 's'}` : '';
  const m = months ? `${months} month${months === 1 ? '' : 's'}` : '';
  return [y, m].filter(Boolean).join(' ');
}

export function fmt(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function fmtLong(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function parse(value: string): number {
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
}
