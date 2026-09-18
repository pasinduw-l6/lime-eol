import { Component, computed, inject, signal } from '@angular/core';
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
}

/**
 * The schedule: one row per cycle in use, each ending on its EOL date.
 *
 * Position carries urgency before colour does — anything left of the today
 * rule is already out of support. The dashed rule is the notice horizon
 * (STATUS_APPROACHING_DAYS); a bar ending before it is what "EOL near" means.
 */
@Component({
  selector: 'lime-schedule',
  host: { class: 'block' },
  template: `
    <header class="border-b border-rule bg-surface px-8 pt-6 pb-5">
      <h1 class="m-0 text-[28px] font-semibold tracking-[-0.01em]">Schedule</h1>
      <p class="mt-1 mb-0 max-w-[62ch] text-[14px] text-ink-soft">
        Every technology cycle running in a customer environment, placed on the
        date its support ends.
      </p>
    </header>

    @if (inbox().length > 0) {
      <section class="border-b border-rule bg-surface px-8 py-4" aria-labelledby="needs-you">
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

    <section class="px-8 py-6">
      <div class="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-ink-soft">
        <span><span class="inline-block h-2 w-3 align-middle" [style.background]="fill('EOL')"></span> past end of life</span>
        <span><span class="inline-block h-2 w-3 align-middle" [style.background]="fill('NEAR')"></span> ends within {{ noticeDays }} days</span>
        <span><span class="inline-block h-2 w-3 align-middle" [style.background]="fill('SUPPORTED')"></span> supported</span>
        <button type="button" class="ml-auto underline" (click)="showTable.set(!showTable())">
          {{ showTable() ? 'Show chart' : 'Show as table' }}
        </button>
      </div>

      @if (!showTable()) {
        <div class="overflow-x-auto">
          <svg
            [attr.width]="width"
            [attr.height]="height()"
            [attr.viewBox]="'0 0 ' + width + ' ' + height()"
            role="img"
            [attr.aria-label]="'Support schedule for ' + rows().length + ' technology cycles'"
          >
            <!-- month gridlines and year labels -->
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

            <!-- the notice horizon: bars ending left of this are "EOL near" -->
            <line
              [attr.x1]="noticeX()" [attr.x2]="noticeX()" y1="18" [attr.y2]="height() - 18"
              stroke="var(--color-soon)" stroke-width="1" stroke-dasharray="3 3"
            />
            <text [attr.x]="noticeX() + 5" [attr.y]="height() - 5" font-size="11" fill="var(--color-soon)">
              notice horizon · {{ noticeDays }} days
            </text>

            <!-- today -->
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
      <aside class="border-t border-rule bg-surface px-8 py-5" aria-labelledby="impact">
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
    this.store.cyclesInUse().map(({ cycle, days, status }, index) => {
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
      };
    }),
  );

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
