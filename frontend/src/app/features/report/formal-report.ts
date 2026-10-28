import { Component, computed, inject, input } from '@angular/core';
import { Api, ApiProject } from '../../core/api';
import { RegistryStore } from '../../core/registry.store';

type Status = 'EOL' | 'NEAR' | 'SUPPORTED' | 'UNKNOWN';

interface Row {
  key: string;
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

interface Bar {
  key: string;
  label: string;
  left: number;
  solid: number;
  striped: number;
  colour: string;
}

const ENV_ORDER = ['DEV', 'UAT', 'PROD'];
const STATUS_ORDER: Status[] = ['EOL', 'NEAR', 'SUPPORTED', 'UNKNOWN'];

const STATUS_INFO: Record<Status, { label: string; heading: string; meaning: string; colour: string; tint: string }> = {
  EOL: {
    label: 'End of support',
    heading: 'Past end of support',
    meaning: 'The vendor no longer releases any fixes, including security fixes.',
    colour: '#b42318',
    tint: '#fef3f2',
  },
  NEAR: {
    label: 'Ending within 180 days',
    heading: 'Ending within 180 days',
    meaning: 'Vendor support ends within the next 180 days.',
    colour: '#b54708',
    tint: '#fffaeb',
  },
  SUPPORTED: {
    label: 'Supported',
    heading: 'Supported',
    meaning: 'The vendor still releases fixes for these versions.',
    colour: '#067647',
    tint: '#ecfdf3',
  },
  UNKNOWN: {
    label: 'No published date',
    heading: 'No published end date',
    meaning: 'The vendor has not published an end-of-support date for these versions.',
    colour: '#475467',
    tint: '#f2f4f7',
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

@Component({
  selector: 'lime-formal-report',
  host: { class: 'block' },
  styles: `
    :host {
      --ink: #101828;
      --soft: #475467;
      --rule: #d0d5dd;
      --band: #f2f4f7;
      --brand: #3b7d0a;
      color: var(--ink);
      font-family: 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.45;
      background: #fff;
    }
    .cover {
      display: flex;
      min-height: 250mm;
      flex-direction: column;
      break-after: page;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--brand);
      font-weight: 700;
    }
    .brand .mark {
      width: 22px;
      height: 22px;
      border: 5px solid var(--brand);
      border-radius: 50%;
    }
    .eyebrow {
      margin: 0;
      color: var(--soft);
      font-size: 8.5pt;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 10px 0 0;
      font-size: 26pt;
      font-weight: 700;
      line-height: 1.15;
    }
    h2 {
      margin: 0 0 4px;
      font-size: 16pt;
      font-weight: 700;
    }
    h3 {
      margin: 16px 0 6px;
      font-size: 13pt;
      font-weight: 700;
      break-after: avoid;
    }
    .new-page {
      break-before: page;
      margin-top: 0;
    }
    .meta {
      margin-top: 22mm;
      border-collapse: collapse;
      font-size: 10pt;
    }
    .meta td {
      padding: 4px 0;
    }
    .meta td:first-child {
      width: 40mm;
      color: var(--soft);
    }
    .sub {
      margin: 0 0 10px;
      color: var(--soft);
      font-size: 10pt;
    }
    .glance {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1.6fr;
      margin: 6px 0 14px;
      border: 1px solid var(--rule);
      break-inside: avoid;
    }
    .glance > div {
      padding: 8px 10px;
      border-right: 1px solid var(--rule);
    }
    .glance > div:last-child {
      border-right: 0;
    }
    .glance b {
      display: block;
      font-size: 19pt;
      line-height: 1.1;
    }
    .glance span {
      color: var(--soft);
      font-size: 9.5pt;
    }
    .chart {
      margin: 4px 0 14px;
      break-inside: avoid;
    }
    .chart-row {
      display: grid;
      grid-template-columns: 44mm 1fr;
      align-items: center;
      height: 22px;
    }
    .chart-label {
      overflow: hidden;
      padding-right: 8px;
      font-size: 9.5pt;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .track {
      position: relative;
      height: 100%;
    }
    .bar {
      position: absolute;
      top: 6px;
      display: flex;
      height: 8px;
      overflow: hidden;
      border-radius: 4px;
    }
    .axis {
      position: relative;
      height: 16px;
      margin-left: 44mm;
      border-top: 1px solid var(--rule);
      color: var(--soft);
      font-size: 8.5pt;
    }
    .axis span:last-child {
      transform: translateX(-100%);
    }
    .axis span {
      position: absolute;
      top: 2px;
      transform: translateX(-50%);
    }
    .gridline {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: #eaecf0;
    }
    .today {
      position: absolute;
      top: -2px;
      bottom: -2px;
      width: 1.5px;
      background: var(--ink);
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 4px;
      color: var(--soft);
      font-size: 9pt;
    }
    .swatch {
      display: inline-block;
      width: 18px;
      height: 7px;
      margin-right: 5px;
      border-radius: 3px;
      vertical-align: 0;
    }
    .group {
      margin-top: 12px;
      break-inside: avoid-page;
    }
    .group-head {
      padding: 6px 10px;
      border-left: 4px solid;
      font-size: 11.5pt;
      font-weight: 700;
      break-after: avoid;
    }
    .group-head small {
      display: block;
      color: var(--soft);
      font-size: 9.5pt;
      font-weight: 400;
    }
    table.eol {
      width: 100%;
      border-collapse: collapse;
    }
    table.eol thead {
      display: table-header-group;
    }
    table.eol th {
      padding: 5px 8px;
      border-bottom: 1.5px solid var(--ink);
      color: var(--soft);
      font-size: 9pt;
      font-weight: 600;
      text-align: left;
    }
    table.eol tr {
      break-inside: avoid;
    }
    table.eol td {
      padding: 7px 8px;
      border-bottom: 1px solid var(--rule);
      vertical-align: top;
    }
    .name {
      font-weight: 700;
    }
    .muted {
      color: var(--soft);
      font-size: 9.5pt;
    }
    .envs {
      white-space: nowrap;
    }
    .env {
      display: inline-block;
      margin: 0 3px 3px 0;
      padding: 0 5px;
      border: 1px solid var(--rule);
      border-radius: 3px;
      font-size: 9pt;
    }
    .dates {
      margin: 0;
      padding: 0;
      list-style: none;
      font-variant-numeric: tabular-nums;
    }
    .dates li span {
      display: inline-block;
      width: 34mm;
      color: var(--soft);
    }
    .story {
      margin-top: 4px;
      font-weight: 600;
    }
    .dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      margin-right: 5px;
      border-radius: 50%;
      vertical-align: 1px;
    }
  `,
  template: `
    @if (customer(); as c) {
      <div class="cover">
        <div class="brand"><span class="mark"></span>lime</div>

        <div style="margin-top: 75mm">
          <p class="eyebrow">Technology lifecycle</p>
          <h1>Technology End-of-Life Report</h1>
          <p style="margin: 10px 0 0; font-size: 13pt; color: var(--soft)">{{ c.name }}</p>
          @if (single(); as p) {
            <p style="margin: 2px 0 0; font-size: 13pt; font-weight: 600">{{ p.name }}</p>
          }
        </div>

        <table class="meta">
          <tr><td>Report date</td><td>{{ fmtLong(asOf) }}</td></tr>
          @if (single(); as p) {
            <tr><td>Project</td><td>{{ p.name }} ({{ p.code }})</td></tr>
            <tr><td>Environments</td><td>{{ envList(p) }}</td></tr>
          } @else {
            <tr><td>Projects</td><td>{{ projectNames() }}</td></tr>
          }
          <tr><td>Technologies</td><td>{{ allRows().length }}</td></tr>
          <tr><td>Prepared by</td><td>Lime · SRE / DevOps</td></tr>
        </table>
      </div>

      <h2>Technology end-of-life details</h2>
      <p class="sub">Vendor support position on {{ fmtLong(asOf) }} for every technology in use. Dates come from vendor publications and endoflife.date.</p>

      <div class="glance">
        <div><b [style.color]="count('EOL') ? info.EOL.colour : null">{{ count('EOL') }}</b><span>Past end of support</span></div>
        <div><b [style.color]="count('NEAR') ? info.NEAR.colour : null">{{ count('NEAR') }}</b><span>Ending within 180 days</span></div>
        <div><b>{{ count('SUPPORTED') }}</b><span>Supported</span></div>
        <div>
          <span>Next end of support</span>
          @if (next(); as n) {
            <div style="margin-top: 2px; font-weight: 700">{{ n.technology }} {{ n.version }}</div>
            <div class="muted">{{ fmt(n.endOfSupport) }} ({{ span(n.days ?? 0) }})</div>
          } @else {
            <div style="margin-top: 2px">None upcoming</div>
          }
        </div>
      </div>

      @for (section of sections(); track section.id) {
        @if (!single()) {
          <h3 [class.new-page]="!$first">{{ section.title }}</h3>
        }

        <div class="chart">
          @for (b of section.bars; track b.key) {
            <div class="chart-row">
              <div class="chart-label">{{ b.label }}</div>
              <div class="track">
                @for (y of axis().ticks; track y.year) {
                  <span class="gridline" [style.left.%]="y.at"></span>
                }
                <div class="bar" [style.left.%]="b.left" [style.width.%]="b.solid + b.striped">
                  <span [style.width.%]="b.solid + b.striped ? (b.solid / (b.solid + b.striped)) * 100 : 0" [style.background]="b.colour"></span>
                  <span style="flex: 1" [style.background]="'repeating-linear-gradient(135deg, ' + b.colour + ' 0 2px, transparent 2px 4px)'"></span>
                </div>
                <span class="today" [style.left.%]="axis().today"></span>
              </div>
            </div>
          }
          <div class="axis">
            @for (y of axis().ticks; track y.year) {
              <span [style.left.%]="y.at">{{ y.year }}</span>
            }
          </div>
          <div class="legend">
            <span><span class="swatch" style="background: #475467"></span>Full support</span>
            <span><span class="swatch" style="background: repeating-linear-gradient(135deg, #475467 0 2px, transparent 2px 4px); border: 1px solid #d0d5dd"></span>Security fixes only</span>
            <span><span class="swatch" style="width: 2px; background: #101828"></span>Today</span>
            <span><span class="dot" [style.background]="info.EOL.colour"></span>Ended</span>
            <span><span class="dot" [style.background]="info.NEAR.colour"></span>Ending within 180 days</span>
            <span><span class="dot" [style.background]="info.SUPPORTED.colour"></span>Supported</span>
          </div>
        </div>

        @for (g of section.groups; track g.status) {
          <div class="group">
            <div class="group-head" [style.border-color]="info[g.status].colour" [style.background]="info[g.status].tint">
              <span [style.color]="info[g.status].colour">{{ info[g.status].heading }}</span> · {{ g.rows.length }}
              <small>{{ info[g.status].meaning }}</small>
            </div>
            <table class="eol">
              <thead>
                <tr>
                  <th style="width: 40mm">Technology</th>
                  <th style="width: 36mm">Environments</th>
                  <th>Vendor support</th>
                  <th style="width: 30mm">Newest vendor version</th>
                </tr>
              </thead>
              <tbody>
                @for (r of g.rows; track r.key) {
                  <tr>
                    <td>
                      <div class="name">{{ r.technology }} {{ r.version }}</div>
                      <div class="muted">{{ r.kind }}</div>
                    </td>
                    <td class="envs">
                      @for (e of r.environments; track e) {
                        <span class="env">{{ e }}</span>
                      }
                    </td>
                    <td>
                      <ul class="dates">
                        <li><span>Released</span>{{ fmt(r.released) }}</li>
                        @if (r.fullSupportEnds) {
                          <li><span>{{ past(r.fullSupportEnds) ? 'Full support ended' : 'Full support ends' }}</span>{{ fmt(r.fullSupportEnds) }}</li>
                        }
                        <li><span>{{ r.days !== null && r.days <= 0 ? 'All support ended' : 'All support ends' }}</span><b>{{ fmt(r.endOfSupport) }}</b></li>
                      </ul>
                      <div class="story" [style.color]="info[r.status].colour">▶ {{ story(r) }}</div>
                    </td>
                    <td>{{ r.newest ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

    }
  `,
})
export class FormalReport {
  private readonly api = inject(Api);
  private readonly store = inject(RegistryStore);

  readonly customerId = input<string | null>(null);
  readonly projectId = input<string | null>(null);

  protected readonly asOf = new Date();
  protected readonly info = STATUS_INFO;

  protected readonly customer = computed(() => {
    const id = this.customerId();
    if (!id) return this.api.customers().length ? { name: 'All projects' } : null;
    return this.api.customers().find((c) => c.id === id) ?? null;
  });

  protected readonly everything = computed(() => !this.customerId() && !this.projectId());

  protected readonly projects = computed(() =>
    this.api
      .projects()
      .filter((p) => (!this.customerId() || p.customerId === this.customerId()) && (!this.projectId() || p.id === this.projectId()))
      .sort((a, b) => a.customer.localeCompare(b.customer) || a.name.localeCompare(b.name)),
  );

  protected readonly single = computed(() => (this.projectId() ? (this.projects()[0] ?? null) : null));

  protected readonly projectNames = computed(() =>
    this.projects().map((p) => (this.everything() ? p.customer + ' ' + p.name : p.name)).join(', '),
  );

  private readonly newestOf = computed(() => {
    const map = new Map<string, string>();
    for (const tech of this.api.technologies()) {
      const newest = [...tech.cycles].sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))[0];
      if (newest) map.set(tech.name, newest.latestPatch ?? newest.cycle);
    }
    return map;
  });

  private rowsOf(project: ApiProject): Row[] {
    const rows = new Map<string, Row>();
    for (const env of project.environments) {
      for (const c of env.components) {
        const key = `${project.id}|${c.technology}|${c.version}`;
        const existing = rows.get(key);
        if (existing) {
          existing.environments.push(env.environment);
          continue;
        }
        rows.set(key, {
          key,
          technology: c.technology,
          version: c.version,
          kind: c.technology === 'Lime' ? 'Lime platform' : (KIND[c.componentType] ?? c.componentType),
          environments: [env.environment],
          released: this.store.resolve(c.technology, c.version).cycle?.releaseDate ?? null,
          fullSupportEnds: c.activeSupportEnd,
          endOfSupport: c.eolDate,
          days: c.daysToEol,
          status: c.status,
          newest: this.newestOf().get(c.technology) ?? null,
        });
      }
    }
    for (const row of rows.values()) row.environments.sort((a, b) => ENV_ORDER.indexOf(a) - ENV_ORDER.indexOf(b));
    return [...rows.values()].sort(
      (a, b) => (a.endOfSupport ?? '9999').localeCompare(b.endOfSupport ?? '9999') || a.technology.localeCompare(b.technology),
    );
  }

  protected readonly allRows = computed(() => this.projects().flatMap((p) => this.rowsOf(p)));

  protected readonly next = computed(
    () =>
      this.allRows()
        .filter((r) => r.days !== null && r.days > 0)
        .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0] ?? null,
  );

  protected readonly axis = computed(() => {
    const rows = this.allRows();
    const starts = rows.map((r) => r.released).filter((d): d is string => !!d).map(parse);
    const ends = rows.map((r) => r.endOfSupport).filter((d): d is string => !!d).map(parse);
    const now = this.asOf.getTime();
    const firstYear = new Date(Math.min(now, ...starts)).getUTCFullYear();
    const lastYear = new Date(Math.max(now, ...ends)).getUTCFullYear() + 1;
    const from = Date.UTC(firstYear, 0, 1);
    const to = Date.UTC(lastYear, 0, 1);
    const at = (t: number) => ((t - from) / (to - from)) * 100;
    const step = lastYear - firstYear > 10 ? 2 : 1;
    const ticks: { year: number; at: number }[] = [];
    for (let y = firstYear; y <= lastYear; y += step) ticks.push({ year: y, at: at(Date.UTC(y, 0, 1)) });
    return { from, to, at, ticks, today: at(now) };
  });

  protected readonly sections = computed(() => {
    const ax = this.axis();
    return this.projects().map((project) => {
      const rows = this.rowsOf(project);
      const bars: Bar[] = rows.map((r) => {
        const start = r.released ? parse(r.released) : ax.from;
        const end = r.endOfSupport ? parse(r.endOfSupport) : ax.to;
        const full = r.fullSupportEnds ? Math.min(parse(r.fullSupportEnds), end) : end;
        return {
          key: r.key,
          label: `${r.technology} ${r.version}`,
          left: ax.at(start),
          solid: ax.at(full) - ax.at(start),
          striped: ax.at(end) - ax.at(full),
          colour: STATUS_INFO[r.status].colour,
        };
      });
      const groups = STATUS_ORDER.map((status) => ({ status, rows: rows.filter((r) => r.status === status) })).filter(
        (g) => g.rows.length > 0,
      );
      const name = this.everything() ? `${project.customer} · ${project.name}` : project.name;
      return { id: project.id, title: `${name} (${project.code})`, bars, groups };
    });
  });

  protected count(status: Status): number {
    return this.allRows().filter((r) => r.status === status).length;
  }

  protected story(r: Row): string {
    const days = r.days;
    if (days === null || !r.endOfSupport) return 'The vendor has not published an end-of-support date';
    if (days <= 0) return `Without vendor fixes for ${this.span(-days)}`;
    const securityOnly = r.fullSupportEnds && this.past(r.fullSupportEnds);
    if (r.status === 'NEAR') {
      return securityOnly
        ? `Security fixes only since ${this.fmt(r.fullSupportEnds)} · all support ends in ${this.span(days)}`
        : `All support ends in ${this.span(days)}`;
    }
    return securityOnly
      ? `Security fixes only since ${this.fmt(r.fullSupportEnds)} · supported for ${this.span(days)}`
      : `Supported for ${this.span(days)}`;
  }

  protected span(days: number): string {
    if (days < 60) return `${days} day${days === 1 ? '' : 's'}`;
    const totalMonths = Math.round(days / 30.44);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const y = years ? `${years} year${years === 1 ? '' : 's'}` : '';
    const m = months ? `${months} month${months === 1 ? '' : 's'}` : '';
    return [y, m].filter(Boolean).join(' ');
  }

  protected past(value: string | null): boolean {
    return !!value && parse(value) < this.asOf.getTime();
  }

  protected envList(project: ApiProject): string {
    return project.environments
      .map((e) => e.environment)
      .sort((a, b) => ENV_ORDER.indexOf(a) - ENV_ORDER.indexOf(b))
      .join(', ');
  }

  protected fmtLong(date: Date): string {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  protected fmt(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
}

function parse(value: string): number {
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
}
