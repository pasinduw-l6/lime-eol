import { Component, computed, inject, signal } from '@angular/core';
import {
  formatDate,
  formatDays,
  parseDate,
  statusFill,
  statusOf,
  today,
} from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';
import { Cycle } from '../../core/models';

interface Day {
  date: Date | null;
  events: { cycle: Cycle; fill: string }[];
  isToday: boolean;
}

interface MonthBand {
  key: string;
  label: string;
  year: number;
  month: number;
  count: number;
  fill: string;
}

/**
 * Calendar tracking.
 *
 * A year band showing where end-of-life dates cluster, and a month grid for
 * the selected month. Answers "what lands in Q4?" — the planning question a
 * list ordered by urgency cannot.
 */
@Component({
  selector: 'lime-calendar',
  host: { class: 'block' },
  template: `
    <header class="card mb-5 px-7 py-6">
      <h1 class="m-0 text-[30px] font-semibold tracking-[-0.02em]">Calendar</h1>
      <p class="mt-1 mb-0 max-w-[62ch] text-[14px] text-ink-soft">
        When support actually ends, month by month, so upgrade work can be
        planned against the quarters it falls in.
      </p>
    </header>

    <section class="card mb-5 px-7 py-5">
      <h2 class="m-0 mb-3 text-[13px] font-semibold">Next 24 months</h2>
      <div class="flex flex-wrap gap-1" role="list">
        @for (band of bands(); track band.key) {
          <button
            type="button"
            role="listitem"
            (click)="pick(band)"
            class="flex w-[62px] flex-col items-start border px-2 py-1 text-left"
            [class.border-ink]="band.key === selectedKey()"
            [class.border-rule]="band.key !== selectedKey()"
            [attr.aria-label]="band.label + ', ' + band.count + ' ending'"
          >
            <span class="text-[11px] text-ink-soft">{{ band.label }}</span>
            <span class="tabular text-[15px]" [style.color]="band.fill">
              {{ band.count || '·' }}
            </span>
          </button>
        }
      </div>
    </section>

    <section class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div class="card px-7 py-6">
        <h2 class="m-0 mb-3 text-[15px] font-semibold">{{ monthLabel() }}</h2>
        <table class="w-full border-collapse">
          <caption class="sr-only">End-of-life dates in {{ monthLabel() }}</caption>
          <thead>
            <tr>
              @for (name of dayNames; track name) {
                <th class="border border-rule bg-surface px-2 py-1 text-[11px] font-medium text-ink-soft">
                  {{ name }}
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (week of weeks(); track $index) {
              <tr>
                @for (day of week; track $index) {
                  <td
                    class="h-[86px] border border-rule align-top"
                    [class.bg-surface]="day.date"
                    [class.bg-ground]="!day.date"
                  >
                    @if (day.date) {
                      <div class="px-2 pt-1">
                        <span
                          class="tabular text-[12px]"
                          [class.font-semibold]="day.isToday"
                          [class.text-ink-soft]="!day.isToday"
                        >{{ day.date.getUTCDate() }}</span>
                        @if (day.isToday) {
                          <span class="ml-1 text-[10px]">today</span>
                        }
                      </div>
                      @for (event of day.events; track event.cycle.id) {
                        <div class="mt-1 px-1">
                          <span
                            class="block border-l-2 pl-1 text-[11px] leading-[1.25]"
                            [style.border-color]="event.fill"
                          >
                            {{ event.cycle.technology }}
                            <span class="tabular">{{ event.cycle.cycle }}</span>
                          </span>
                        </div>
                      }
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <aside class="card px-7 py-6">
        <h2 class="m-0 mb-3 text-[15px] font-semibold">Ending soonest</h2>
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (row of upcoming(); track row.cycle.id) {
            <li class="border-b border-rule pb-2">
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-[14px] font-medium">
                  {{ row.cycle.technology }} {{ row.cycle.cycle }}
                </span>
                <span class="tabular text-[13px]" [style.color]="row.fill">
                  {{ row.days }}
                </span>
              </div>
              <div class="tabular text-[12px] text-ink-soft">
                {{ row.date }} · {{ row.environments }} environment(s)
              </div>
            </li>
          }
        </ul>
      </aside>
    </section>
  `,
})
export class Calendar {
  private readonly store = inject(RegistryStore);

  protected readonly dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  private readonly cursor = signal(today());
  protected readonly selectedKey = computed(() => {
    const c = this.cursor();
    return `${c.getUTCFullYear()}-${c.getUTCMonth()}`;
  });

  /** Every in-use cycle that has a published end date. */
  private readonly events = computed(() =>
    this.store
      .cyclesInUse()
      .filter(({ cycle }) => cycle.eolDate)
      .map(({ cycle, days, status }) => ({
        cycle,
        days,
        status,
        date: parseDate(cycle.eolDate)!,
        fill: statusFill(status),
      })),
  );

  protected readonly bands = computed<MonthBand[]>(() => {
    const start = today();
    const out: MonthBand[] = [];

    for (let i = 0; i < 24; i++) {
      const ms = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1);
      const d = new Date(ms);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const inMonth = this.events().filter(
        (e) => e.date.getUTCFullYear() === year && e.date.getUTCMonth() === month,
      );
      const worst = inMonth.some((e) => e.status === 'EOL')
        ? 'EOL'
        : inMonth.some((e) => e.status === 'NEAR')
          ? 'NEAR'
          : 'SUPPORTED';

      out.push({
        key: `${year}-${month}`,
        label: d.toLocaleDateString('en-GB', {
          month: 'short',
          year: '2-digit',
          timeZone: 'UTC',
        }),
        year,
        month,
        count: inMonth.length,
        fill: inMonth.length ? statusFill(worst) : 'var(--color-rule)',
      });
    }
    return out;
  });

  protected readonly monthLabel = computed(() =>
    this.cursor().toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  );

  protected readonly weeks = computed<Day[][]>(() => {
    const cursor = this.cursor();
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const first = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    // Monday-first offset.
    const offset = (first.getUTCDay() + 6) % 7;
    const now = today().getTime();

    const cells: Day[] = [];
    for (let i = 0; i < offset; i++) {
      cells.push({ date: null, events: [], isToday: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month, day));
      cells.push({
        date,
        isToday: date.getTime() === now,
        events: this.events()
          .filter((e) => e.date.getTime() === date.getTime())
          .map((e) => ({ cycle: e.cycle, fill: e.fill })),
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, events: [], isToday: false });
    }

    const weeks: Day[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  });

  protected readonly upcoming = computed(() =>
    this.events()
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 8)
      .map((e) => ({
        cycle: e.cycle,
        days: formatDays(e.days),
        date: formatDate(e.cycle.eolDate),
        fill: e.fill,
        environments: this.store.deploymentsUsing(e.cycle).length,
      })),
  );

  protected pick(band: MonthBand): void {
    this.cursor.set(new Date(Date.UTC(band.year, band.month, 1)));
  }

  protected readonly statusOf = statusOf;
}
