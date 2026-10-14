import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { Api, ApiProject } from '../../core/api';
import { ReportDownload } from '../../core/report-download';
import { RegistryStore } from '../../core/registry.store';
import { DownloadMenu } from '../../shared/download-menu';
import { TechIcon } from '../../shared/tech-icon';

type Status = 'EOL' | 'NEAR' | 'SUPPORTED' | 'UNKNOWN';
type Health = 'red' | 'amber' | 'green';

interface Item {
  technology: string;
  version: string;
  cycle: string;
  environments: string[];
  endOfSupport: string | null;
  days: number | null;
  status: Status;
  risk: RiskAcceptance | null;
}

interface RiskAcceptance {
  approver: string | null;
  expires: string | null;
  daysLeft: number | null;
}

interface ProjectCard {
  id: string;
  name: string;
  code: string;
  customer: string;
  lime: string;
  environments: string[];
  health: Health;
  eol: number;
  near: number;
  supported: number;
  attention: Item[];
  next: Item | null;
  total: number;
  inProd: number;
  items: Item[];
  longest: Item | null;
}

const ENV_ORDER = ['DEV', 'UAT', 'PROD'];

const HEALTH: Record<Health, { label: string; colour: string; tint: string }> = {
  red: { label: 'Past end of support', colour: 'var(--color-overdue)', tint: 'color-mix(in oklab, var(--color-overdue) 9%, transparent)' },
  amber: { label: 'Ending within 180 days', colour: 'var(--color-soon)', tint: 'color-mix(in oklab, var(--color-soon) 10%, transparent)' },
  green: { label: 'All supported', colour: 'var(--color-good)', tint: 'color-mix(in oklab, var(--color-good) 9%, transparent)' },
};

const STATUS_COLOUR: Record<Status, string> = {
  EOL: 'var(--color-overdue)',
  NEAR: 'var(--color-soon)',
  SUPPORTED: 'var(--color-good)',
  UNKNOWN: 'var(--muted-foreground)',
};

@Component({
  selector: 'lime-manager',
  imports: [FormsModule, HlmButton, HlmCardImports, HlmInput, TechIcon, DownloadMenu],
  host: { class: 'block' },
  template: `
    <header class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-3xl font-semibold tracking-tight">Manager view</h1>
        <p class="m-0 mt-1 text-sm text-muted-foreground">
          End-of-life position of each project, as of {{ today }}. Worst first.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <input
          hlmInput
          type="search"
          class="h-9 w-[220px]"
          placeholder="Search project or customer"
          aria-label="Search projects"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
        />
        <select hlmInput class="h-9 w-auto" aria-label="Customer" [ngModel]="customer()" (ngModelChange)="customer.set($event)">
          <option value="">All customers</option>
          @for (c of customers(); track c) {
            <option [value]="c">{{ c }}</option>
          }
        </select>
        <div class="segmented" role="group" aria-label="Status">
          @for (f of filters; track f.key) {
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1 text-[13px]"
              [class.bg-background]="health() === f.key"
              [class.shadow-sm]="health() === f.key"
              [class.text-foreground]="health() === f.key"
              [class.text-ink-soft]="health() !== f.key"
              (click)="health.set(f.key)"
            >
              @if (f.key !== 'all') {
                <span class="size-2 rounded-full" [style.background]="healthInfo[f.key].colour"></span>
              }
              {{ f.label }} <span class="tabular text-muted-foreground">{{ countOf(f.key) }}</span>
            </button>
          }
        </div>
        <lime-download-menu label="Full report download" [busy]="downloads.busy() === 'all'" (pick)="downloads.all($event)" />
      </div>
    </header>

    <div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      @for (p of visible(); track p.id) {
        <article hlmCard class="gap-0 overflow-hidden py-0">
          <header class="flex items-start justify-between gap-3 border-b px-5 py-4" [style.background]="healthInfo[p.health].tint">
            <div class="min-w-0">
              <p class="m-0 text-[12px] text-muted-foreground">{{ p.customer }}</p>
              <h2 class="m-0 truncate text-lg font-semibold">{{ p.name }}</h2>
              <p class="m-0 mt-0.5 text-[12px] text-muted-foreground">
                {{ p.code }} · Lime {{ p.lime }} · {{ p.environments.join(' · ') || 'no environments' }}
              </p>
            </div>
            <span
              class="flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[12px] font-medium"
              [style.color]="healthInfo[p.health].colour"
              [style.border-color]="'color-mix(in oklab, ' + healthInfo[p.health].colour + ' 40%, transparent)'"
            >
              <span class="size-2 rounded-full" [style.background]="healthInfo[p.health].colour"></span>
              {{ healthInfo[p.health].label }}
            </span>
          </header>

          <div class="grid grid-cols-3 border-b text-center">
            <div class="border-r px-3 py-3">
              <p class="m-0 text-2xl font-semibold tabular" [style.color]="p.eol ? statusColour.EOL : null">{{ p.eol }}</p>
              <p class="m-0 text-[11.5px] text-muted-foreground">Past end of support</p>
            </div>
            <div class="border-r px-3 py-3">
              <p class="m-0 text-2xl font-semibold tabular" [style.color]="p.near ? statusColour.NEAR : null">{{ p.near }}</p>
              <p class="m-0 text-[11.5px] text-muted-foreground">Ending ≤ 180 days</p>
            </div>
            <div class="px-3 py-3">
              <p class="m-0 text-2xl font-semibold tabular">{{ p.supported }}</p>
              <p class="m-0 text-[11.5px] text-muted-foreground">Supported</p>
            </div>
          </div>

          @if (p.attention.length) {
            <div class="grid grid-cols-2 border-b text-[12px]">
              <div class="border-r px-5 py-2.5">
                <span class="block text-muted-foreground">In production</span>
                @if (p.inProd) {
                  <span class="font-semibold" [style.color]="statusColour.EOL">{{ p.inProd }} of {{ p.attention.length }} {{ p.attention.length === 1 ? 'item runs' : 'items run' }} in PROD</span>
                } @else {
                  <span class="font-semibold">None in PROD</span>
                }
              </div>
              <div class="px-5 py-2.5">
                <span class="block text-muted-foreground">Longest exposure</span>
                @if (p.longest; as l) {
                  <span class="font-semibold" [style.color]="statusColour.EOL">{{ l.technology }} {{ l.version }} · {{ span(-(l.days ?? 0)) }}</span>
                } @else {
                  <span class="font-semibold">Nothing past end of support</span>
                }
              </div>
            </div>
          }

          <div class="flex-1 px-5 py-4">
            @if (p.attention.length) {
              <p class="m-0 mb-2 text-[12px] font-medium text-muted-foreground">Needs attention</p>
              <ul class="m-0 grid list-none gap-3 p-0">
                @for (i of p.attention; track i.technology + i.version) {
                  <li class="text-[13px]">
                    <div class="flex items-center gap-3">
                      <lime-tech-icon [technology]="i.technology" [size]="18" />
                      <span class="min-w-0 flex-1">
                        <span class="flex items-center gap-1.5">
                          <span class="truncate font-medium">{{ i.technology }} {{ i.version }}</span>
                          @if (i.environments.includes('PROD')) {
                            <span
                              class="shrink-0 rounded px-1.5 text-[10.5px] font-semibold"
                              title="Runs in production"
                              [style.color]="statusColour[i.status]"
                              [style.background]="'color-mix(in oklab, ' + statusColour[i.status] + ' 14%, transparent)'"
                            >PROD</span>
                          }
                        </span>
                        <span class="block text-[11.5px] text-muted-foreground">{{ i.environments.join(', ') }}</span>
                      </span>
                      <span class="shrink-0 text-right">
                        <span class="block text-[12.5px] tabular" [style.color]="statusColour[i.status]">{{ date(i.endOfSupport) }}</span>
                        <span class="block text-[11.5px]" [style.color]="statusColour[i.status]">{{ remaining(i.days) }}</span>
                      </span>
                    </div>
                    @if (i.risk; as r) {
                      @let tone = riskTone(r);
                      <div
                        class="mt-1.5 ml-[30px] rounded-md px-2 py-1 text-[11.5px]"
                        [style.color]="tone.colour"
                        [style.background]="'color-mix(in oklab, ' + tone.colour + ' 10%, transparent)'"
                      >
                        ✓ Risk accepted{{ r.approver ? ' by ' + r.approver : '' }}
                        @if (r.expires) {
                          · {{ tone.text }}
                        } @else {
                          · no expiry date set
                        }
                      </div>
                    }
                  </li>
                }
              </ul>
            } @else {
              <p class="m-0 text-[13px] text-muted-foreground">Every technology in this project is supported by its vendor.</p>
            }
          </div>

          <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-[12.5px]">
            <span class="text-muted-foreground">
              @if (p.next; as n) {
                Next end of support: <b class="text-foreground">{{ n.technology }} {{ n.version }}</b> · {{ date(n.endOfSupport) }}
              } @else {
                {{ p.total }} technologies · no upcoming end of support
              }
            </span>
            <span class="flex gap-1.5">
              <lime-download-menu label="Report" variant="outline" size="sm" [busy]="downloads.busy() === p.id" (pick)="downloads.project(p.id, $event)" />
              <button type="button" hlmBtn size="sm" (click)="open(p)">Open</button>
            </span>
          </footer>
        </article>
      } @empty {
        <p hlmCard class="col-span-full block px-6 py-10 text-center text-muted-foreground">
          @if (api.isLoading()) {
            Loading…
          } @else {
            No project matches.
          }
        </p>
      }
    </div>

    @if (visible().length) {
      <section hlmCard class="mt-6 gap-0 py-0" aria-labelledby="calendar-title">
        <header class="border-b px-6 py-4">
          <h2 id="calendar-title" class="m-0 text-lg font-semibold">Upcoming end of support</h2>
          <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">What has already ended and what ends in the next 12 months, by quarter.</p>
        </header>
        <div class="divide-y">
          @for (q of calendar(); track q.label) {
            <div class="grid gap-3 px-6 py-3 md:grid-cols-[150px_1fr]">
              <div>
                <span class="text-[13px] font-semibold" [style.color]="q.ended ? statusColour.EOL : null">{{ q.label }}</span>
                <span class="block text-[11.5px] text-muted-foreground">{{ q.entries.length }} {{ q.entries.length === 1 ? 'technology' : 'technologies' }}</span>
              </div>
              <div class="flex flex-wrap gap-2">
                @for (e of q.entries; track e.key) {
                  <div
                    class="min-w-[220px] rounded-lg border px-3 py-2 text-[12.5px]"
                    [style.border-color]="'color-mix(in oklab, ' + statusColour[e.status] + ' 35%, transparent)'"
                    [style.background]="'color-mix(in oklab, ' + statusColour[e.status] + ' 6%, transparent)'"
                  >
                    <div class="flex items-center gap-2">
                      <lime-tech-icon [technology]="e.technology" [size]="16" />
                      <span class="font-medium">{{ e.technology }} {{ e.cycle }}</span>
                      @if (e.prod) {
                        <span class="rounded px-1 text-[10px] font-semibold" [style.color]="statusColour[e.status]" [style.background]="'color-mix(in oklab, ' + statusColour[e.status] + ' 14%, transparent)'">PROD</span>
                      }
                    </div>
                    <div class="mt-0.5 tabular" [style.color]="statusColour[e.status]">{{ date(e.date) }} · {{ remaining(e.days) }}</div>
                    <div class="mt-0.5 text-[11.5px] text-muted-foreground">{{ e.projects.join(', ') }}</div>
                  </div>
                }
              </div>
            </div>
          } @empty {
            <p class="m-0 px-6 py-6 text-[13px] text-muted-foreground">Nothing has ended and nothing ends in the next 12 months.</p>
          }
        </div>
      </section>

      <section hlmCard class="mt-6 gap-0 py-0" aria-labelledby="matrix-title">
        <header class="border-b px-6 py-4">
          <h2 id="matrix-title" class="m-0 text-lg font-semibold">Technology by project</h2>
          <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">Which version each project runs, coloured by vendor support. Shows where the same problem appears in several projects.</p>
        </header>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-[12.5px]">
            <thead>
              <tr class="text-muted-foreground">
                <th class="sticky left-0 z-10 min-w-[180px] bg-card px-6 py-2.5 text-left font-medium">Technology</th>
                @for (p of visible(); track p.id) {
                  <th class="min-w-[120px] border-l px-3 py-2.5 text-left font-medium">
                    <span class="block text-foreground">{{ p.name }}</span>
                    <span class="block text-[11px] font-normal">{{ p.customer }}</span>
                  </th>
                }
                <th class="border-l px-3 py-2.5 text-left font-medium">Projects affected</th>
              </tr>
            </thead>
            <tbody>
              @for (row of matrix(); track row.technology) {
                <tr class="border-t">
                  <td class="sticky left-0 z-10 bg-card px-6 py-2">
                    <span class="flex items-center gap-2 font-medium">
                      <lime-tech-icon [technology]="row.technology" [size]="16" />
                      {{ row.technology }}
                    </span>
                  </td>
                  @for (p of visible(); track p.id) {
                    @let cell = row.cells[p.id];
                    <td class="border-l px-3 py-2">
                      @if (cell) {
                        @for (v of cell; track v.version) {
                          <span
                            class="mr-1 mb-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 tabular"
                            [title]="statusLabel[v.status] + (v.endOfSupport ? ' · ' + date(v.endOfSupport) : '') + ' · ' + v.environments.join(', ')"
                            [style.color]="statusColour[v.status]"
                            [style.background]="'color-mix(in oklab, ' + statusColour[v.status] + ' 12%, transparent)'"
                          >
                            <span class="size-1.5 rounded-full" [style.background]="statusColour[v.status]"></span>{{ v.version }}
                          </span>
                        }
                      } @else {
                        <span class="text-muted-foreground">—</span>
                      }
                    </td>
                  }
                  <td class="border-l px-3 py-2 whitespace-nowrap">
                    @if (row.ended) {
                      <span [style.color]="statusColour.EOL">{{ row.ended }} past end of support</span>
                    }
                    @if (row.ended && row.ending) {
                      <br />
                    }
                    @if (row.ending) {
                      <span [style.color]="statusColour.NEAR">{{ row.ending }} ending soon</span>
                    }
                    @if (!row.ended && !row.ending) {
                      <span class="text-muted-foreground">All supported</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <footer class="flex flex-wrap gap-4 border-t px-6 py-2.5 text-[12px] text-muted-foreground">
          <span><span class="mr-1 inline-block size-2 rounded-full" [style.background]="statusColour.EOL"></span>Past end of support</span>
          <span><span class="mr-1 inline-block size-2 rounded-full" [style.background]="statusColour.NEAR"></span>Ending within 180 days</span>
          <span><span class="mr-1 inline-block size-2 rounded-full" [style.background]="statusColour.SUPPORTED"></span>Supported</span>
          <span>Hover a version for its end-of-support date and environments.</span>
        </footer>
      </section>
    }
  `,
})
export class Manager {
  protected readonly api = inject(Api);
  private readonly store = inject(RegistryStore);
  private readonly router = inject(Router);
  protected readonly downloads = inject(ReportDownload);

  protected readonly healthInfo = HEALTH;
  protected readonly statusColour = STATUS_COLOUR;
  protected readonly span = span;

  private readonly accepted = computed(() =>
    this.api.actions().filter((a) => a.decision === 'ACCEPT_RISK' && a.status !== 'COMPLETED'),
  );

  private riskFor(projectId: string, technology: string, cycle: string): RiskAcceptance | null {
    const plan = this.accepted().find(
      (a) => a.technology === technology && a.cycle === cycle && a.environments.some((e) => e.projectId === projectId),
    );
    if (!plan) return null;
    const daysLeft = plan.riskExpiresAt
      ? Math.round((Date.parse(`${plan.riskExpiresAt}T00:00:00Z`) - startOfToday()) / 86_400_000)
      : null;
    return { approver: plan.riskApprover, expires: plan.riskExpiresAt, daysLeft };
  }

  protected riskTone(r: RiskAcceptance): { colour: string; text: string } {
    if (r.daysLeft === null) return { colour: 'var(--muted-foreground)', text: '' };
    if (r.daysLeft < 0) return { colour: STATUS_COLOUR.EOL, text: `expired ${this.date(r.expires)}` };
    if (r.daysLeft <= 30) {
      return { colour: STATUS_COLOUR.NEAR, text: `expires in ${span(r.daysLeft)} (${this.date(r.expires)})` };
    }
    return { colour: 'oklch(0.5 0.13 255)', text: `until ${this.date(r.expires)}` };
  }
  protected readonly today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  protected readonly filters: { key: Health | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'red', label: 'Past end of support' },
    { key: 'amber', label: 'Ending soon' },
    { key: 'green', label: 'Supported' },
  ];

  protected readonly query = signal('');
  protected readonly customer = signal('');
  protected readonly health = signal<Health | 'all'>('all');

  protected readonly customers = computed(() => [...new Set(this.api.projects().map((p) => p.customer))].sort());

  protected readonly cards = computed<ProjectCard[]>(() =>
    this.api
      .projects()
      .map((p) => this.toCard(p))
      .sort(
        (a, b) =>
          rankOf(a.health) - rankOf(b.health) ||
          b.eol - a.eol ||
          b.near - a.near ||
          `${a.customer} ${a.name}`.localeCompare(`${b.customer} ${b.name}`),
      ),
  );

  protected readonly visible = computed(() => {
    const needle = this.query().trim().toLowerCase();
    return this.cards().filter(
      (c) =>
        (this.health() === 'all' || c.health === this.health()) &&
        (!this.customer() || c.customer === this.customer()) &&
        (!needle || `${c.customer} ${c.name} ${c.code}`.toLowerCase().includes(needle)),
    );
  });

  protected readonly statusLabel: Record<Status, string> = {
    EOL: 'Past end of support',
    NEAR: 'Ending within 180 days',
    SUPPORTED: 'Supported',
    UNKNOWN: 'No published date',
  };

  protected readonly calendar = computed(() => {
    const limit = 366;
    const entries = new Map<
      string,
      { key: string; technology: string; cycle: string; date: string; days: number; status: Status; prod: boolean; projects: string[] }
    >();

    for (const card of this.visible()) {
      for (const i of card.items) {
        if (!i.endOfSupport || i.days === null || i.days > limit) continue;
        const key = `${i.technology}|${i.cycle}`;
        const entry = entries.get(key) ?? {
          key,
          technology: i.technology,
          cycle: i.cycle,
          date: i.endOfSupport,
          days: i.days,
          status: i.status,
          prod: false,
          projects: [],
        };
        if (!entry.projects.includes(card.name)) entry.projects.push(card.name);
        entry.prod ||= i.environments.includes('PROD');
        entries.set(key, entry);
      }
    }

    const quarters = new Map<string, { label: string; ended: boolean; order: string; entries: typeof list }>();
    const list = [...entries.values()].sort((a, b) => a.date.localeCompare(b.date));
    for (const e of list) {
      const ended = e.days <= 0;
      const label = ended ? 'Already ended' : quarterOf(e.date);
      const order = ended ? '0000' : e.date.slice(0, 7);
      const q = quarters.get(label) ?? { label, ended, order, entries: [] };
      q.entries.push(e);
      quarters.set(label, q);
    }
    return [...quarters.values()].sort((a, b) => a.order.localeCompare(b.order));
  });

  protected readonly matrix = computed(() => {
    const rows = new Map<
      string,
      { technology: string; cells: Record<string, Item[]>; ended: number; ending: number; worst: number }
    >();
    const rank: Record<Status, number> = { EOL: 0, NEAR: 1, SUPPORTED: 2, UNKNOWN: 3 };

    for (const card of this.visible()) {
      for (const i of card.items) {
        const row = rows.get(i.technology) ?? { technology: i.technology, cells: {}, ended: 0, ending: 0, worst: 9 };
        (row.cells[card.id] ??= []).push(i);
        row.worst = Math.min(row.worst, rank[i.status]);
        rows.set(i.technology, row);
      }
    }

    for (const row of rows.values()) {
      const cells = Object.values(row.cells);
      row.ended = cells.filter((c) => c.some((i) => i.status === 'EOL')).length;
      row.ending = cells.filter((c) => !c.some((i) => i.status === 'EOL') && c.some((i) => i.status === 'NEAR')).length;
    }

    return [...rows.values()].sort(
      (a, b) => a.worst - b.worst || b.ended - a.ended || b.ending - a.ending || a.technology.localeCompare(b.technology),
    );
  });

  protected countOf(key: Health | 'all'): number {
    return key === 'all' ? this.cards().length : this.cards().filter((c) => c.health === key).length;
  }

  private toCard(project: ApiProject): ProjectCard {
    const items = new Map<string, Item>();
    for (const env of project.environments) {
      for (const c of env.components) {
        const key = `${c.technology}|${c.version}`;
        const existing = items.get(key);
        if (existing) {
          existing.environments.push(env.environment);
          continue;
        }
        items.set(key, {
          technology: c.technology,
          version: c.version,
          cycle: c.cycle,
          environments: [env.environment],
          endOfSupport: c.eolDate,
          days: c.daysToEol,
          status: c.status,
          risk: this.riskFor(project.id, c.technology, c.cycle),
        });
      }
    }
    const list = [...items.values()];
    for (const i of list) i.environments.sort((a, b) => ENV_ORDER.indexOf(a) - ENV_ORDER.indexOf(b));

    const eol = list.filter((i) => i.status === 'EOL').length;
    const near = list.filter((i) => i.status === 'NEAR').length;
    const attention = list
      .filter((i) => i.status === 'EOL' || i.status === 'NEAR')
      .sort((a, b) => (a.endOfSupport ?? '').localeCompare(b.endOfSupport ?? ''));
    const next =
      list.filter((i) => i.days !== null && i.days > 0).sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0] ?? null;

    return {
      id: project.id,
      name: project.name,
      code: project.code,
      customer: project.customer,
      lime: project.limeVersion ?? '—',
      environments: project.environments
        .map((e) => e.environment)
        .sort((a, b) => ENV_ORDER.indexOf(a) - ENV_ORDER.indexOf(b)),
      health: eol ? 'red' : near ? 'amber' : 'green',
      eol,
      near,
      supported: list.filter((i) => i.status === 'SUPPORTED').length,
      attention,
      next,
      total: list.length,
      items: list,
      inProd: attention.filter((i) => i.environments.includes('PROD')).length,
      longest:
        list
          .filter((i) => i.status === 'EOL' && i.days !== null)
          .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))[0] ?? null,
    };
  }

  protected open(card: ProjectCard): void {
    this.store.scope.set(card.id);
    void this.router.navigateByUrl('/overview');
  }

  protected date(value: string | null): string {
    if (!value) return 'No date';
    return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  protected remaining(days: number | null): string {
    if (days === null) return '';
    if (days <= 0) return `ended ${span(-days)} ago`;
    return `in ${span(days)}`;
  }
}

function rankOf(health: Health): number {
  return health === 'red' ? 0 : health === 'amber' ? 1 : 2;
}

function span(days: number): string {
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} months`;
  return `${(days / 365.25).toFixed(1)} years`;
}

function startOfToday(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function quarterOf(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
}
