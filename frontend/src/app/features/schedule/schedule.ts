import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  NOTICE_DAYS,
  formatDate,
  formatDays,
  statusFill,
  statusLabel,
  statusTextClass,
  today,
} from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';
import { Cycle } from '../../core/models';
import { TechnologyView } from './technology-view';

// The slug each technology carries is the one the registry stored when it was
// added, so it is read from the data rather than kept in a list here. The list
// this replaced was keyed on display names and said "RHEL", while the registry
// calls it "Red Hat Enterprise Linux" - so it vanished from this page, along
// with anything else anyone added from the catalogue.

const MS_PER_DAY = 86_400_000;
const CHART_WIDTH = 940;
const ROW_HEIGHT = 30;
const LABEL_WIDTH = 210;
const MONTHS_BEHIND = 9;
const MONTHS_AHEAD = 27;

interface Row {
  cycle: Cycle;
  days: number | null;
  status: ReturnType<RegistryStore['worstStatus']>;
  x1: number;
  x2: number;
  y: number;
  fill: string;
  deployments: number;
  customers: number;
  /** "HNB PROD", "Sampath PROD" — what the hover box lists. */
  environments: string[];
}

@Component({
  selector: 'lime-schedule',
  imports: [TechnologyView, RouterLink],
  host: { class: 'block' },
  template: `
    <header class="card mb-5 px-7 py-6">
      <h1 class="m-0 text-[30px] font-semibold tracking-[-0.02em]">Schedule</h1>
      <p class="mt-1 mb-4 max-w-[62ch] text-[14px] text-ink-soft">
        @if (picked() === 'estate') {
          Every technology cycle running in a customer environment, placed on the
          date its support ends.
        } @else {
          Every published release of one technology, with the cycles you run
          marked.
        }
      </p>

      <div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Choose a technology">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="picked() === 'estate'"
          class="glass rounded-full border px-4 py-1.5 text-[13px]"
          [class.border-ink]="picked() === 'estate'"
          [class.bg-ink]="picked() === 'estate'"
          [class.text-ground]="picked() === 'estate'"
          [class.border-rule]="picked() !== 'estate'"
          [class.text-ink-soft]="picked() !== 'estate'"
          (click)="picked.set('estate')"
        >
          Your estate
        </button>

        @for (tech of technologies(); track tech.name) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="picked() === tech.name"
            class="glass flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px]"
            [class.border-ink]="picked() === tech.name"
            [class.bg-ink]="picked() === tech.name"
            [class.text-ground]="picked() === tech.name"
            [class.border-rule]="picked() !== tech.name"
            [class.text-ink-soft]="picked() !== tech.name"
            (click)="picked.set(tech.name)"
          >
            {{ tech.name }}
            @if (tech.atRisk > 0 && picked() !== tech.name) {
              <span class="tabular text-[11px] text-overdue">{{ tech.atRisk }}</span>
            }
          </button>
        }
      </div>
    </header>

    @if (status() !== 'ALL' && picked() === 'estate') {
      <div class="card mb-5 flex flex-wrap items-center gap-3 px-7 py-3">
        <span class="text-[13px] text-ink-soft">Showing only</span>
        <span
          class="rounded-full border px-3 py-1 text-[13px]"
          [style.border-color]="statusColour()"
          [style.color]="statusColour()"
        >
          {{ statusText() }}
        </span>
        <a
          [routerLink]="['/schedule']"
          [queryParams]="{}"
          class="text-[13px] text-accent-bright no-underline hover:underline"
          >Clear filter</a
        >
      </div>
    }

    @if (picked() !== 'estate') {
      <section class="card px-7 py-6">
        <lime-technology-view [slug]="slugFor(picked())" [technology]="picked()" />
      </section>
    } @else {

    @if (inbox().length > 0) {
      <section class="card mb-5 px-7 py-5" aria-labelledby="needs-you">
        <h2 id="needs-you" class="m-0 mb-2 text-[13px] font-semibold">
          Needs you
        </h2>
        <ul class="m-0 flex list-none flex-col gap-1 p-0">
          @for (item of inbox(); track item.cycle.id) {
            <li class="flex flex-wrap items-baseline gap-x-2 text-[14px]">
              <span class="tabular w-[72px] shrink-0 text-right" [class]="textClass(item.days)">
                {{ days(item.days) }}
              </span>
              <span class="font-medium">{{ item.cycle.technology }} {{ item.cycle.cycle }}</span>
              <span class="text-ink-soft">
                {{ item.deployments.length }} environment(s),
                {{ customerNames(item) }}
              </span>
              @if (item.action) {
                <span class="text-ink-soft">
                  — {{ item.action.jiraKey }} planned {{ date(item.action.plannedDate) }}
                </span>
              } @else {
                <span class="font-medium text-overdue">— no upgrade planned</span>
              }
            </li>
          }
        </ul>
      </section>
    }

    <section class="card px-7 py-6">
      <div class="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-ink-soft">
        <span><span class="inline-block h-2 w-3 align-middle" [style.background]="fill('EOL')"></span> past end of life</span>
        <span><span class="inline-block h-2 w-3 align-middle" [style.background]="fill('NEAR')"></span> ends within {{ noticeDays }} days</span>
        <span><span class="inline-block h-2 w-3 align-middle" [style.background]="fill('SUPPORTED')"></span> supported</span>
        <button type="button" class="ml-auto underline" (click)="showTable.set(!showTable())">
          {{ showTable() ? 'Show chart' : 'Show as table' }}
        </button>
      </div>

      @if (!showTable()) {
        <div class="relative overflow-x-auto">
          @if (hovered(); as row) {
            <div
              class="glass pointer-events-none absolute z-10 rounded-lg border px-3 py-2 text-[12px] shadow-lg"
              [style.top.px]="row.y + 26"
              [style.left.px]="200"
              role="tooltip"
            >
              <p class="m-0 font-semibold">
                {{ row.cycle.technology }} {{ row.cycle.cycle }}
              </p>
              @if (row.environments.length === 0) {
                <p class="m-0 mt-1 text-ink-soft">Not running anywhere</p>
              } @else {
                <p class="m-0 mt-1 text-ink-soft">
                  Running in {{ row.environments.length }}
                </p>
                @for (env of row.environments; track env) {
                  <p class="m-0">{{ env }}</p>
                }
              }
            </div>
          }

          <svg
            [attr.width]="width"
            [attr.height]="height()"
            [attr.viewBox]="'0 0 ' + width + ' ' + height()"
            role="img"
            [attr.aria-label]="'Support schedule for ' + rows().length + ' technology cycles'"
          >
            @for (tick of ticks(); track tick.x) {
              <line
                [attr.x1]="tick.x" [attr.x2]="tick.x"
                y1="18" [attr.y2]="height() - 18"
                stroke="var(--color-rule)" [attr.stroke-width]="tick.major ? 1 : 0.5"
              />
              @if (tick.major) {
                <text [attr.x]="tick.x + 4" y="13" font-size="11" fill="var(--color-ink-soft)">
                  {{ tick.label }}
                </text>
              }
            }

            <line
              [attr.x1]="noticeX()" [attr.x2]="noticeX()" y1="18" [attr.y2]="height() - 18"
              stroke="var(--color-soon)" stroke-width="1" stroke-dasharray="3 3"
            />
            <text [attr.x]="noticeX() + 5" [attr.y]="height() - 5" font-size="11" fill="var(--color-soon)">
              notice horizon · {{ noticeDays }} days
            </text>

            <line
              [attr.x1]="todayX()" [attr.x2]="todayX()" y1="18" [attr.y2]="height() - 18"
              stroke="var(--color-ink)" stroke-width="1.5"
            />
            <text [attr.x]="todayX() - 5" [attr.y]="height() - 5" font-size="11" text-anchor="end" fill="var(--color-ink)">
              today
            </text>

            @for (row of rows(); track row.cycle.id) {
              <g
                tabindex="0"
                role="button"
                [attr.aria-label]="rowLabel(row)"
                (click)="select(row.cycle)"
                (keydown.enter)="select(row.cycle)"
                (keydown.space)="select(row.cycle)"
                (mouseenter)="hovered.set(row)"
                (mouseleave)="hovered.set(null)"
                (focus)="hovered.set(row)"
                (blur)="hovered.set(null)"
                class="cursor-pointer"
              >
                <rect
                  x="0" [attr.y]="row.y - 3" [attr.width]="width" [attr.height]="ROW_HEIGHT"
                  [attr.fill]="selected()?.id === row.cycle.id ? 'var(--color-ground)' : 'transparent'"
                />
                <text x="0" [attr.y]="row.y + 14" font-size="13" fill="var(--color-ink)">
                  {{ row.cycle.technology }}
                  <tspan fill="var(--color-ink-soft)">{{ row.cycle.label }}</tspan>
                </text>
                <rect
                  [attr.x]="row.x1" [attr.y]="row.y + 4" [attr.width]="row.x2 - row.x1"
                  height="10" [attr.fill]="row.fill" rx="1"
                />
                <text
                  [attr.x]="width" [attr.y]="row.y + 14" font-size="12" text-anchor="end"
                  class="tabular" [attr.fill]="row.fill"
                >
                  {{ days(row.days) }}
                </text>
              </g>
            }
          </svg>
        </div>
      } @else {
        <table class="w-full border-collapse text-[14px]">
          <caption class="sr-only">Support schedule as data</caption>
          <thead>
            <tr class="border-b border-rule text-left">
              <th class="py-2 pr-4 font-medium">Technology</th>
              <th class="py-2 pr-4 font-medium">Cycle</th>
              <th class="py-2 pr-4 font-medium">End of life</th>
              <th class="py-2 pr-4 font-medium">Days</th>
              <th class="py-2 pr-4 font-medium">Status</th>
              <th class="py-2 font-medium">Environments</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.cycle.id) {
              <tr class="border-b border-rule">
                <td class="py-2 pr-4">{{ row.cycle.technology }}</td>
                <td class="tabular py-2 pr-4">{{ row.cycle.cycle }}</td>
                <td class="tabular py-2 pr-4">{{ date(row.cycle.eolDate) }}</td>
                <td class="tabular py-2 pr-4" [class]="textClass(row.days)">{{ days(row.days) }}</td>
                <td class="py-2 pr-4">{{ label(row.days) }}</td>
                <td class="py-2">{{ row.deployments }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>

    @if (selected(); as cycle) {
      <aside class="card mt-5 px-7 py-5" aria-labelledby="impact">
        <div class="flex items-baseline justify-between gap-4">
          <h2 id="impact" class="m-0 text-[17px] font-semibold">
            {{ cycle.technology }} {{ cycle.label }}
          </h2>
          <button type="button" class="text-[13px] underline" (click)="selected.set(null)">
            Close
          </button>
        </div>
        <dl class="m-0 mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-[14px] sm:grid-cols-4">
          <div>
            <dt class="text-[12px] text-ink-soft">End of life</dt>
            <dd class="tabular m-0">{{ date(cycle.eolDate) }}</dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-soft">Active support ends</dt>
            <dd class="tabular m-0">{{ date(cycle.activeSupportEnd) }}</dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-soft">Latest patch</dt>
            <dd class="tabular m-0">{{ cycle.latestPatch ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-soft">Source</dt>
            <dd class="m-0">{{ cycle.eolSource === 'API' ? 'endoflife.date' : 'entered by hand' }}</dd>
          </div>
        </dl>

        <h3 class="mt-4 mb-1 text-[13px] font-semibold">Affected environments</h3>
        <ul class="m-0 flex list-none flex-col gap-1 p-0 text-[14px]">
          @for (d of impact(); track d.id) {
            <li>
              <span class="font-medium">{{ d.customer }}</span>
              <span class="text-ink-soft">
                · {{ d.name }} · {{ d.environment }} · {{ d.locationDetail }} ·
                {{ d.owners.join(', ') }}
              </span>
            </li>
          } @empty {
            <li class="text-ink-soft">Not deployed anywhere.</li>
          }
        </ul>
      </aside>
    }
    }
  `,
})
export class Schedule {
  private readonly store = inject(RegistryStore);

  protected readonly noticeDays = NOTICE_DAYS;
  protected readonly width = CHART_WIDTH;
  protected readonly ROW_HEIGHT = ROW_HEIGHT;
  protected readonly selected = signal<Cycle | null>(null);
  protected readonly showTable = signal(false);
  protected readonly inbox = this.store.inbox;

  protected readonly picked = signal<string>('estate');

  readonly status = input<'ALL' | 'EOL' | 'NEAR' | 'SUPPORTED'>('ALL');

  protected readonly statusText = computed(() => {
    const status = this.status();
    return status === 'ALL' ? '' : statusLabel(status);
  });

  protected readonly statusColour = computed(() => {
    const status = this.status();
    return status === 'ALL' ? 'var(--color-ink-soft)' : statusFill(status);
  });

  protected readonly technologies = computed(() => {
    const names = [...new Set(this.store.cycles().map((c) => c.technology))];

    // Anything with a slug can have its published releases looked up. A
    // technology without one is tracked by hand - Lime itself - and has no
    // upstream schedule to show, so it is the only thing left out.
    const slugs = new Map(
      this.store
        .technologies()
        .filter((t) => t.eolSlug)
        .map((t) => [t.name, t.eolSlug as string]),
    );

    return names
      .filter((name) => slugs.has(name))
      .map((name) => ({
        name,
        atRisk: this.store
          .cyclesInUse()
          .filter(
            (c) =>
              c.cycle.technology === name &&
              (c.status === 'EOL' || c.status === 'NEAR'),
          ).length,
      }))
      .sort((a, b) => b.atRisk - a.atRisk || a.name.localeCompare(b.name));
  });

  protected slugFor(technology: string): string {
    const known = this.store
      .technologies()
      .find((t) => t.name === technology)?.eolSlug;

    return known ?? technology.toLowerCase();
  }

  private readonly windowStart = computed(() => {
    const t = today();
    return Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - MONTHS_BEHIND, 1);
  });

  private readonly windowEnd = computed(() => {
    const t = today();
    return Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + MONTHS_AHEAD, 1);
  });

  private x(ms: number): number {
    const start = this.windowStart();
    const span = this.windowEnd() - start;
    const ratio = (ms - start) / span;
    return (
      LABEL_WIDTH +
      Math.max(0, Math.min(1, ratio)) * (CHART_WIDTH - LABEL_WIDTH - 60)
    );
  }

  protected readonly rows = computed<Row[]>(() =>
    this.store
      .cyclesInUse()
      .filter((entry) => this.status() === 'ALL' || entry.status === this.status())
      .map(({ cycle, days, status }, index) => {
      const release = cycle.releaseDate
        ? Date.parse(`${cycle.releaseDate}T00:00:00Z`)
        : this.windowStart();
      const eol = cycle.eolDate
        ? Date.parse(`${cycle.eolDate}T00:00:00Z`)
        : this.windowEnd();
      const deployments = this.store.deploymentsUsing(cycle);

      return {
        cycle,
        days,
        status,
        x1: this.x(release),
        x2: Math.max(this.x(release) + 2, this.x(eol)),
        y: 30 + index * ROW_HEIGHT,
        fill: statusFill(status),
        deployments: deployments.length,
        customers: new Set(deployments.map((d) => d.customer)).size,
        // Named, not counted. "3 environments" sends you looking; "HNB PROD,
        // Sampath PROD" usually answers the question where you are standing.
        environments: [
          ...new Set(
            deployments.map((d) => `${d.customer} ${d.environment}`),
          ),
        ].sort(),
      };
    }),
  );

  /** The row under the pointer, or focused by keyboard. */
  protected readonly hovered = signal<Row | null>(null);

  protected readonly height = computed(() => 60 + this.rows().length * ROW_HEIGHT);
  protected readonly todayX = computed(() => this.x(today().getTime()));
  protected readonly noticeX = computed(() =>
    this.x(today().getTime() + NOTICE_DAYS * MS_PER_DAY),
  );

  protected readonly ticks = computed(() => {
    const out: { x: number; label: string; major: boolean }[] = [];
    const start = new Date(this.windowStart());
    const end = this.windowEnd();

    for (let i = 0; ; i++) {
      const ms = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1);
      if (ms > end) {
        break;
      }
      const d = new Date(ms);
      const major = d.getUTCMonth() === 0;
      out.push({ x: this.x(ms), label: String(d.getUTCFullYear()), major });
    }
    return out;
  });

  protected readonly impact = computed(() => {
    const cycle = this.selected();
    return cycle ? this.store.deploymentsUsing(cycle) : [];
  });

  protected select(cycle: Cycle): void {
    this.selected.set(this.selected()?.id === cycle.id ? null : cycle);
  }

  protected days = formatDays;
  protected date = formatDate;
  protected fill = statusFill;

  protected textClass(days: number | null): string {
    return statusTextClass(this.statusFor(days));
  }

  protected label(days: number | null): string {
    return statusLabel(this.statusFor(days));
  }

  protected rowLabel(row: Row): string {
    return `${row.cycle.technology} ${row.cycle.label}, ${this.label(row.days)}, ${this.days(row.days)}, ${row.deployments} environments`;
  }

  protected customerNames(item: { deployments: { customer: string }[] }): string {
    return [...new Set(item.deployments.map((d) => d.customer))].join(', ');
  }

  private statusFor(days: number | null) {
    return days === null ? 'UNKNOWN' : days <= 0 ? 'EOL' : days <= NOTICE_DAYS ? 'NEAR' : 'SUPPORTED';
  }
}
