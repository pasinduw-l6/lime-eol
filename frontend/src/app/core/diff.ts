import { EnvTopology } from './models';


export type DiffType = 'same' | 'add' | 'remove';

export interface DiffLine {
  type: DiffType;
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

export function stringifyTopology(topology: EnvTopology): string {
  const normalised = {
    deploymentId: topology.deploymentId,
    nodes: topology.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      role: n.role,
      host: n.host ?? '',
      x: n.x,
      y: n.y,
      stack: n.stack.map((s) => ({
        technology: s.technology,
        version: s.version,
      })),
    })),
    links: topology.links.map((l) => ({
      from: l.from,
      to: l.to,
      label: l.label ?? '',
    })),
  };

  return JSON.stringify(normalised, null, 2);
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const rows = a.length;
  const cols = b.length;

  const lcs: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(cols + 1).fill(0),
  );

  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;

  while (i < rows && j < cols) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i], oldNo: oldNo++, newNo: newNo++ });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'remove', text: a[i], oldNo: oldNo++, newNo: null });
      i++;
    } else {
      out.push({ type: 'add', text: b[j], oldNo: null, newNo: newNo++ });
      j++;
    }
  }
  while (i < rows) {
    out.push({ type: 'remove', text: a[i++], oldNo: oldNo++, newNo: null });
  }
  while (j < cols) {
    out.push({ type: 'add', text: b[j++], oldNo: null, newNo: newNo++ });
  }

  return out;
}

export function withContext(lines: DiffLine[], context = 3): (DiffLine | 'gap')[] {
  const keep = new Set<number>();

  lines.forEach((line, index) => {
    if (line.type === 'same') {
      return;
    }
    for (let k = index - context; k <= index + context; k++) {
      if (k >= 0 && k < lines.length) {
        keep.add(k);
      }
    }
  });

  const out: (DiffLine | 'gap')[] = [];
  let skipping = false;

  lines.forEach((line, index) => {
    if (keep.has(index)) {
      out.push(line);
      skipping = false;
    } else if (!skipping) {
      out.push('gap');
      skipping = true;
    }
  });

  return out;
}

export interface Segment {
  text: string;
  changed: boolean;
}

export interface SideRow {
  old: { no: number | null; segments: Segment[]; changed: boolean } | null;
  new: { no: number | null; segments: Segment[]; changed: boolean } | null;
}

const TOKEN = /[A-Za-z0-9_.-]+|\s+|./g;

export function diffWords(before: string, after: string): [Segment[], Segment[]] {
  const a = before.match(TOKEN) ?? [];
  const b = after.match(TOKEN) ?? [];
  const rows = a.length;
  const cols = b.length;

  const lcs: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(cols + 1).fill(0),
  );
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const left: Segment[] = [];
  const right: Segment[] = [];
  let i = 0;
  let j = 0;

  const push = (into: Segment[], text: string, changed: boolean) => {
    const last = into[into.length - 1];
    if (last && last.changed === changed) {
      last.text += text;
    } else {
      into.push({ text, changed });
    }
  };

  while (i < rows && j < cols) {
    if (a[i] === b[j]) {
      push(left, a[i], false);
      push(right, b[j], false);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(left, a[i++], true);
    } else {
      push(right, b[j++], true);
    }
  }
  while (i < rows) {
    push(left, a[i++], true);
  }
  while (j < cols) {
    push(right, b[j++], true);
  }

  return [left, right];
}

export function toSideBySide(lines: DiffLine[]): SideRow[] {
  const rows: SideRow[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.type === 'same') {
      rows.push({
        old: { no: line.oldNo, segments: [{ text: line.text, changed: false }], changed: false },
        new: { no: line.newNo, segments: [{ text: line.text, changed: false }], changed: false },
      });
      index++;
      continue;
    }

    const removed: DiffLine[] = [];
    const added: DiffLine[] = [];
    while (index < lines.length && lines[index].type === 'remove') {
      removed.push(lines[index++]);
    }
    while (index < lines.length && lines[index].type === 'add') {
      added.push(lines[index++]);
    }

    const pairs = Math.max(removed.length, added.length);
    for (let k = 0; k < pairs; k++) {
      const before = removed[k];
      const after = added[k];

      if (before && after) {
        const [left, right] = diffWords(before.text, after.text);
        rows.push({
          old: { no: before.oldNo, segments: left, changed: true },
          new: { no: after.newNo, segments: right, changed: true },
        });
      } else if (before) {
        rows.push({
          old: { no: before.oldNo, segments: [{ text: before.text, changed: true }], changed: true },
          new: null,
        });
      } else if (after) {
        rows.push({
          old: null,
          new: { no: after.newNo, segments: [{ text: after.text, changed: true }], changed: true },
        });
      }
    }
  }

  return rows;
}

export function collapse(rows: SideRow[], context = 3): (SideRow | 'gap')[] {
  const changed = (row: SideRow) => row.old?.changed || row.new?.changed || !row.old || !row.new;
  const keep = new Set<number>();

  rows.forEach((row, index) => {
    if (!changed(row)) {
      return;
    }
    for (let k = index - context; k <= index + context; k++) {
      if (k >= 0 && k < rows.length) {
        keep.add(k);
      }
    }
  });

  const out: (SideRow | 'gap')[] = [];
  let skipping = false;

  rows.forEach((row, index) => {
    if (keep.has(index)) {
      out.push(row);
      skipping = false;
    } else if (!skipping) {
      out.push('gap');
      skipping = true;
    }
  });

  return out;
}

export interface ComponentChange {
  kind: 'UPGRADE' | 'DOWNGRADE' | 'ADDED' | 'REMOVED';
  node: string;
  technology: string;
  from: string | null;
  to: string | null;
}

export function summariseChange(
  before: EnvTopology | null,
  after: EnvTopology,
): ComponentChange[] {
  const index = (t: EnvTopology | null) => {
    const map = new Map<string, { node: string; version: string }>();
    for (const node of t?.nodes ?? []) {
      for (const entry of node.stack) {
        map.set(`${node.id}::${entry.technology}`, {
          node: node.name,
          version: entry.version,
        });
      }
    }
    return map;
  };

  const from = index(before);
  const to = index(after);
  const changes: ComponentChange[] = [];

  for (const [key, next] of to) {
    const technology = key.split('::')[1];
    const previous = from.get(key);

    if (!previous) {
      changes.push({
        kind: 'ADDED',
        node: next.node,
        technology,
        from: null,
        to: next.version,
      });
    } else if (previous.version !== next.version) {
      changes.push({
        kind: compare(previous.version, next.version) < 0 ? 'UPGRADE' : 'DOWNGRADE',
        node: next.node,
        technology,
        from: previous.version,
        to: next.version,
      });
    }
  }

  for (const [key, previous] of from) {
    if (!to.has(key)) {
      changes.push({
        kind: 'REMOVED',
        node: previous.node,
        technology: key.split('::')[1],
        from: previous.version,
        to: null,
      });
    }
  }

  return changes;
}

function compare(a: string, b: string): number {
  const parse = (v: string) =>
    v.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}
