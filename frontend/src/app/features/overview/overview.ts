import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  NOTICE_DAYS,
  formatDate,
  formatDays,
  parseDate,
  statusFill,
  today,
} from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';

const LINE_W = 520;
const LINE_H = 150;

interface Band {
  key: 'EOL' | 'NEAR' | 'SUPPORTED';
  label: string;
  count: number;
  share: number;
  colour: string;
  bars: number[];
}

/**
 * Overview.
 *
 * The three questions in one screen: how much is at risk, when it lands, and
 * what needs a decision today. Counts are the headline, but every number is a
 * link into the detail that explains it.
 */
@Component({
  selector: 'lime-overview',
  imports: [RouterLink],
  host: { class: 'block' },
  template: `
    <!-- ── headline row ───────────────────────────────────────────── -->
    <section class="card mb-5 px-7 py-6">
      <div class="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="m-0 text-[34px] font-semibold tracking-[-0.02em]">
            Lifecycle overview
          </h1>
          <p class="m-0 text-[14px] text-ink-soft">
            {{ deploymentCount() }} environments across
            {{ customerCount() }} customers · Lime 2026.1
          </p>
        </div>

        <div class="flex gap-1 rounded-full border border-rule bg-elevated p-1">
          @for (h of horizons; track h) {
            <button
              type="button"
              class="rounded-full px-4 py-1.5 text-[13px]"
              [class.bg-ink]="horizon() === h"
              [class.text-ground]="horizon() === h"
              [class.text-ink-soft]="horizon() !== h"
              (click)="horizon.set(h)"
            >
              {{ h }}m
            </button>
          }
        </div>
      </div>

      <div class="grid gap-7 lg:grid-cols-[300px_1fr]">
        <!-- hero metric -->
        <div class="lg:border-r lg:border-rule lg:pr-7">
          <p class="m-0 text-[13px] text-ink-soft">Cycles at risk</p>
          <p class="m-0 mt-1 flex items-baseline gap-1 text-[46px] leading-none font-semibold tracking-[-0.02em]">
            <span>{{ atRisk() }}</span>
            <span class="text-[26px] text-ink-faint">/{{ inUse() }}</span>
          </p>
          <p class="m-0 mt-2 text-[13px]">
            <span class="tabular text-overdue">{{ overdue() }} past end of life</span>
            <span class="text-ink-soft"> · {{ nearCount() }} within {{ noticeDays }} days</span>
          </p>

          <div class="mt-5 flex flex-wrap gap-2">
            <a routerLink="/schedule" class="btn btn-primary">Open schedule</a>
            <a routerLink="/environments" class="btn">Environments</a>
          </div>
        </div>

        <!-- status bands: shape of the risk, not just a number -->
        <div class="grid gap-6 sm:grid-cols-3">
          @for (band of bands(); track band.key) {
            <div class="flex flex-col">
              <p class="m-0 text-[22px] font-semibold tabular">{{ band.count }}</p>
              <p class="m-0 mb-3 text-[13px]">
                <span [style.color]="band.colour">{{ band.share }}%</span>
                <span class="text-ink-soft"> {{ band.label }}</span>
              </p>
              <div class="flex h-[62px] items-end gap-[3px]" aria-hidden="true">
                @for (bar of band.bars; track $index) {
                  <span
                    class="flex-1 rounded-[2px]"
                    [style.height.%]="bar"
                    [style.background]="band.colour"
                    [style.opacity]="0.35 + (bar / 100) * 0.65"
                  ></span>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ── three panels ───────────────────────────────────────────── -->
    <div class="grid gap-5 xl:grid-cols-[1.15fr_1fr_0.95fr]">
      <!-- support ending, cumulative -->
      <section class="card px-6 py-5">
        <header class="mb-4 flex items-baseline justify-between gap-3">
          <h2 class="m-0 text-[15px] font-semibold">Support ending</h2>
          <span class="text-[12px] text-ink-soft">next {{ horizon() }} months</span>
        </header>

        <svg
          [attr.viewBox]="'0 0 ' + lineW + ' ' + lineH"
          class="w-full"
          role="img"
          [attr.aria-label]="'Cumulative cycles reaching end of life over ' + horizon() + ' months'"
        >
          <defs>
            <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.45" />
              <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0" />
            </linearGradient>
          </defs>

          @for (g of gridLines; track g) {
            <line x1="0" [attr.x2]="lineW" [attr.y1]="g" [attr.y2]="g"
                  stroke="var(--color-rule)" stroke-width="1" />
          }

          <path [attr.d]="areaPath()" fill="url(#fade)" />
          <path [attr.d]="linePath()" fill="none" stroke="var(--color-accent-bright)" stroke-width="2" />

          @for (p of points(); track p.i) {
            @if (p.marked) {
              <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3.5" fill="var(--color-accent-bright)" />
            }
          }
        </svg>

        <div class="mt-3 flex justify-between text-[12px] text-ink-soft">
          <span>{{ firstMonth() }}</span>
          <span class="tabular">{{ totalInHorizon() }} cycles</span>
          <span>{{ lastMonth() }}</span>
        </div>
      </section>

      <!-- density heatmap: where the work lands -->
      <section class="card px-6 py-5">
        <header class="mb-4 flex items-baseline justify-between gap-3">
          <h2 class="m-0 text-[15px] font-semibold">When it lands</h2>
          <span class="text-[12px] text-ink-soft">by month</span>
        </header>

        <table class="w-full border-separate border-spacing-[3px]">
          <caption class="sr-only">Count of cycles reaching end of life per month</caption>
          <thead>
            <tr>
              <th></th>
              @for (m of monthNames; track m) {
                <th class="pb-1 text-[10px] font-normal text-ink-faint">{{ m }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of heatmap(); track row.year) {
              <tr>
                <th class="pr-2 text-right text-[11px] font-normal text-ink-soft">{{ row.year }}</th>
                @for (cell of row.cells; track cell.month) {
                  <td
                    class="h-[26px] rounded-[4px]"
                    [style.background]="cell.background"
                    [attr.title]="cell.title"
                  >
                    <span class="sr-only">{{ cell.title }}</span>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>

        <div class="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-ink-soft">
          <span>less</span>
          @for (step of legend; track step) {
            <span class="h-3 w-4 rounded-[3px]" [style.background]="shade(step)"></span>
          }
          <span>more</span>
        </div>
      </section>

      <!-- needs you -->
      <section class="card px-6 py-5">
        <header class="mb-4 flex items-baseline justify-between gap-3">
          <h2 class="m-0 text-[15px] font-semibold">Needs you</h2>
          <a routerLink="/schedule" class="text-[12px] text-accent-bright no-underline hover:underline">
            All items
          </a>
        </header>

        <ul class="m-0 flex list-none flex-col p-0">
          @for (item of inbox(); track item.cycle.id) {
            <li class="flex items-center gap-3 border-b border-rule py-2.5 last:border-b-0">
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                [style.background]="fill(item.days === null ? 'UNKNOWN' : item.days <= 0 ? 'EOL' : 'NEAR')"
                aria-hidden="true"
              ></span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[14px]">
                  {{ item.cycle.technology }} {{ item.cycle.cycle }}
                </span>
                <span class="block truncate text-[12px] text-ink-soft">
                  {{ item.deployments.length }} env ·
                  {{ item.action ? item.action.jiraKey : 'no plan' }}
                </span>
              </span>
              <span
                class="tabular shrink-0 text-[13px]"
                [style.color]="fill(item.days === null ? 'UNKNOWN' : item.days <= 0 ? 'EOL' : 'NEAR')"
              >
                {{ days(item.days) }}
              </span>
            </li>
          } @empty {
            <li class="py-3 text-[13px] text-ink-soft">Nothing needs attention.</li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class Overview {
  private readonly store = inject(RegistryStore);

  protected readonly noticeDays = NOTICE_DAYS;
  protected readonly lineW = LINE_W;
  protected readonly lineH = LINE_H;
  protected readonly horizons = [6, 12, 24] as const;
  protected readonly horizon = signal<number>(12);
  protected readonly monthNames = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  protected readonly legend = [0.15, 0.35, 0.6, 1];
  protected readonly inbox = this.store.inbox;

  protected readonly inUse = computed(() => this.store.cyclesInUse().length);
  protected readonly overdue = computed(
    () => this.store.cyclesInUse().filter((c) => c.status === 'EOL').length,
  );
  protected readonly nearCount = computed(
    () => this.store.cyclesInUse().filter((c) => c.status === 'NEAR').length,
  );
  protected readonly atRisk = computed(() => this.overdue() + this.nearCount());

  protected readonly deploymentCount = computed(
    () => this.store.deployments().length,
  );
  protected readonly customerCount = computed(
    () => new Set(this.store.deployments().map((d) => d.customer)).size,
  );

  /** Each band gets a bar per member, heights ranked by urgency. */
  protected readonly bands = computed<Band[]>(() => {
    const all = this.store.cyclesInUse();
    const total = Math.max(1, all.length);

    const build = (key: Band['key'], label: string): Band => {
      const members = all.filter((c) => c.status === key);
      const bars = members.length
        ? members.map((m, i) => 100 - (i / Math.max(1, members.length)) * 55)
        : [8];
      return {
        key,
        label,
        count: members.length,
        share: Math.round((members.length / total) * 100),
        colour: statusFill(key),
        bars,
      };
    };

    return [
      build('EOL', 'past end of life'),
      build('NEAR', `within ${NOTICE_DAYS} days`),
      build('SUPPORTED', 'supported'),
    ];
  });

  /** Cumulative count of cycles whose support has ended, month by month. */
  private readonly series = computed(() => {
    const months = this.horizon();
    const start = today();
    const dated = this.store
      .cyclesInUse()
      .map((c) => parseDate(c.cycle.eolDate))
      .filter((d): d is Date => d !== null);

    const out: number[] = [];
    for (let i = 0; i <= months; i++) {
      const edge = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + 1, 0);
      out.push(dated.filter((d) => d.getTime() <= edge).length);
    }
    return out;
  });

  protected readonly points = computed(() => {
    const values = this.series();
    const max = Math.max(1, ...values);
    return values.map((v, i) => ({
      i,
      x: (i / Math.max(1, values.length - 1)) * LINE_W,
      y: LINE_H - 10 - (v / max) * (LINE_H - 30),
      marked: i > 0 && v > values[i - 1],
    }));
  });

  protected readonly linePath = computed(() =>
    this.points()
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' '),
  );

  protected readonly areaPath = computed(
    () => `${this.linePath()} L${LINE_W},${LINE_H} L0,${LINE_H} Z`,
  );

  protected readonly gridLines = [30, 70, 110];

  protected readonly totalInHorizon = computed(() => {
    const values = this.series();
    return values[values.length - 1] - values[0];
  });

  protected readonly firstMonth = computed(() => this.monthLabel(0));
  protected readonly lastMonth = computed(() => this.monthLabel(this.horizon()));

  /** Years × months grid of how many cycles end in each month. */
  protected readonly heatmap = computed(() => {
    const start = today().getUTCFullYear();
    const dated = this.store
      .cyclesInUse()
      .map((c) => ({ date: parseDate(c.cycle.eolDate), cycle: c.cycle }))
      .filter((e): e is { date: Date; cycle: (typeof e)['cycle'] } => e.date !== null);

    const years = [start, start + 1, start + 2];
    const max = Math.max(
      1,
      ...years.flatMap((y) =>
        Array.from({ length: 12 }, (_, m) =>
          dated.filter(
            (e) => e.date.getUTCFullYear() === y && e.date.getUTCMonth() === m,
          ).length,
        ),
      ),
    );

    return years.map((year) => ({
      year,
      cells: Array.from({ length: 12 }, (_, month) => {
        const hits = dated.filter(
          (e) => e.date.getUTCFullYear() === year && e.date.getUTCMonth() === month,
        );
        return {
          month,
          count: hits.length,
          background: hits.length ? this.shade(hits.length / max) : 'var(--color-elevated)',
          title: hits.length
            ? `${hits.length} ending in ${this.monthName(month)} ${year}: ${hits
                .map((h) => `${h.cycle.technology} ${h.cycle.cycle}`)
                .join(', ')}`
            : `Nothing ends in ${this.monthName(month)} ${year}`,
        };
      }),
    }));
  });

  protected shade(intensity: number): string {
    const clamped = Math.max(0.15, Math.min(1, intensity));
    return `color-mix(in oklab, var(--color-accent) ${Math.round(clamped * 100)}%, var(--color-elevated))`;
  }

  private monthLabel(offset: number): string {
    const start = today();
    return new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1),
    ).toLocaleDateString('en-GB', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    });
  }

  private monthName(month: number): string {
    return new Date(Date.UTC(2026, month, 1)).toLocaleDateString('en-GB', {
      month: 'long',
      timeZone: 'UTC',
    });
  }

  protected days = formatDays;
  protected date = formatDate;
  protected fill = statusFill;
}
