import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate, formatDays, parseDate, statusFill, today } from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';

type EventKind = 'DEADLINE' | 'PLANNED' | 'DONE';

interface CalEvent {
  id: string;
  kind: EventKind;
  date: Date;
  title: string;
  sub: string;
  colour: string;
  overdue: boolean;
}

interface Day {
  date: Date | null;
  key: string;
  events: CalEvent[];
  isToday: boolean;
  isSelected: boolean;
}

const KIND_COLOUR: Record<EventKind, string> = {
  DEADLINE: 'var(--color-overdue)',
  PLANNED: 'var(--color-accent-bright)',
  DONE: 'var(--color-good)',
};

/**
 * Calendar.
 *
 * Three things share the grid: deadlines we don't control, work we planned,
 * and work actually recorded. Seeing them together is the point — a month full
 * of deadlines with no planned work beside them is the failure this tool
 * exists to make visible.
 */
@Component({
  selector: 'lime-calendar',
  imports: [RouterLink],
  host: { class: 'block' },
  template: `
    <header class="card mb-5 px-7 py-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="m-0 text-[30px] font-semibold tracking-[-0.02em]">Calendar</h1>
          <p class="m-0 text-[14px] text-ink-soft">
            {{ monthSummary() }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-1 rounded-full border border-rule bg-elevated p-1">
            <button type="button" class="rounded-full px-3 py-1.5 text-[13px] text-ink-soft" (click)="shift(-1)" aria-label="Previous month">‹</button>
            <button type="button" class="rounded-full px-3 py-1.5 text-[13px]" (click)="goToday()">Today</button>
            <button type="button" class="rounded-full px-3 py-1.5 text-[13px] text-ink-soft" (click)="shift(1)" aria-label="Next month">›</button>
          </div>
        </div>
      </div>

      <!-- what to show -->
      <div class="mt-5 flex flex-wrap gap-2">
        @for (kind of kinds; track kind.key) {
          <button
            type="button"
            class="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px]"
            [class.border-rule]="!enabled().includes(kind.key)"
            [class.text-ink-faint]="!enabled().includes(kind.key)"
            [style.border-color]="enabled().includes(kind.key) ? kind.colour : null"
            [style.color]="enabled().includes(kind.key) ? kind.colour : null"
            [attr.aria-pressed]="enabled().includes(kind.key)"
            (click)="toggle(kind.key)"
          >
            <span class="h-2 w-2 rounded-full" [style.background]="kind.colour"></span>
            {{ kind.label }}
            <span class="tabular text-[12px]">{{ countOf(kind.key) }}</span>
          </button>
        }
      </div>
    </header>

    <!-- 24-month band -->
    <section class="card mb-5 px-7 py-5">
      <h2 class="m-0 mb-3 text-[13px] font-semibold">Next 24 months</h2>
      <div class="flex flex-wrap gap-1" role="list">
        @for (band of bands(); track band.key) {
          <button
            type="button"
            role="listitem"
            (click)="pick(band.year, band.month)"
            class="flex w-[64px] flex-col items-start gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors hover:bg-elevated"
            [class.border-accent]="band.key === selectedKey()"
            [class.bg-elevated]="band.key === selectedKey()"
            [class.border-rule]="band.key !== selectedKey()"
            [attr.aria-label]="band.label + ': ' + band.deadlines + ' deadlines, ' + band.planned + ' planned'"
          >
            <span class="text-[11px] text-ink-soft">{{ band.label }}</span>
            <span class="flex h-1.5 w-full gap-[2px]">
              @if (band.deadlines) {
                <span class="h-full rounded-full" [style.flex]="band.deadlines" style="background: var(--color-overdue)"></span>
              }
              @if (band.planned) {
                <span class="h-full rounded-full" [style.flex]="band.planned" style="background: var(--color-accent-bright)"></span>
              }
              @if (!band.deadlines && !band.planned) {
                <span class="h-full w-full rounded-full bg-elevated"></span>
              }
            </span>
          </button>
        }
      </div>
    </section>

    <section class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <!-- month grid -->
      <div class="card px-7 py-6">
        <h2 class="m-0 mb-3 text-[15px] font-semibold">{{ monthLabel() }}</h2>
        <div class="overflow-hidden rounded-xl border border-rule">
          <table class="w-full border-collapse">
            <caption class="sr-only">Lifecycle events in {{ monthLabel() }}</caption>
            <thead>
              <tr class="bg-elevated">
                @for (name of dayNames; track name) {
                  <th class="px-2 py-2 text-[11px] font-medium tracking-wide text-ink-soft">
                    {{ name }}
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (week of weeks(); track $index) {
                <tr>
                  @for (day of week; track day.key) {
                    <td
                      class="h-[96px] w-[14.28%] border-t border-l border-rule p-0 align-top first:border-l-0"
                      [class.bg-ground]="!day.date"
                    >
                      @if (day.date) {
                        <button
                          type="button"
                          class="day flex h-full w-full flex-col items-stretch px-1.5 pt-1.5 text-left"
                          [class.day-today]="day.isToday"
                          [class.day-selected]="day.isSelected"
                          (click)="select(day)"
                          [attr.aria-label]="dayLabel(day)"
                          [attr.aria-pressed]="day.isSelected"
                        >
                          <span class="mb-1 flex items-center justify-between gap-1 px-0.5">
                            <span
                              class="tabular text-[12px]"
                              [class.font-semibold]="day.isToday"
                              [class.text-ink]="day.isToday"
                              [class.text-ink-soft]="!day.isToday"
                              >{{ day.date.getUTCDate() }}</span
                            >
                            @if (day.events.length > 0) {
                              <span class="flex gap-[3px]">
                                @for (dot of day.events.slice(0, 3); track dot.id) {
                                  <span
                                    class="h-1.5 w-1.5 rounded-full"
                                    [style.background]="dot.colour"
                                    aria-hidden="true"
                                  ></span>
                                }
                              </span>
                            }
                          </span>

                          @for (event of day.events.slice(0, 2); track event.id) {
                            <span
                              class="chip mb-0.5"
                              [style.border-left-color]="event.colour"
                              [style.background]="tint(event.colour)"
                              [style.color]="event.overdue ? 'var(--color-overdue)' : 'var(--color-ink)'"
                              >{{ event.title }}</span
                            >
                          }
                          @if (day.events.length > 2) {
                            <span class="px-1 text-[10px] text-ink-faint">
                              +{{ day.events.length - 2 }} more
                            </span>
                          }
                        </button>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- side: agenda, then the gap -->
      <aside class="flex flex-col gap-5">
        <div class="card px-6 py-5">
          <h2 class="m-0 mb-3 text-[15px] font-semibold">
            {{ selected() ? dayHeading() : 'Next 60 days' }}
          </h2>
          <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
            @for (event of agenda(); track event.id) {
              <li class="flex gap-2.5 border-b border-rule pb-2.5 last:border-b-0 last:pb-0">
                <span
                  class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  [style.background]="event.colour"
                  aria-hidden="true"
                ></span>
                <span class="min-w-0 flex-1">
                  <span class="block text-[13px]">{{ event.title }}</span>
                  <span class="block text-[11.5px] text-ink-soft">{{ event.sub }}</span>
                </span>
                <span class="tabular shrink-0 text-[11px] text-ink-faint">
                  {{ shortDate(event.date) }}
                </span>
              </li>
            } @empty {
              <li class="text-[13px] text-ink-soft">Nothing scheduled.</li>
            }
          </ul>
          @if (selected()) {
            <button type="button" class="mt-3 text-[12px] text-accent-bright" (click)="selected.set(null)">
              Back to the next 60 days
            </button>
          }
        </div>

        <!-- deadlines nobody is on -->
        <div class="card px-6 py-5">
          <h2 class="m-0 mb-1 text-[15px] font-semibold">Unplanned deadlines</h2>
          <p class="m-0 mb-3 text-[12px] text-ink-soft">
            Support ending with no upgrade action against it.
          </p>
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            @for (row of unplanned(); track row.id) {
              <li class="flex items-baseline justify-between gap-2 border-b border-rule pb-2 last:border-b-0 last:pb-0">
                <span class="min-w-0">
                  <span class="block truncate text-[13px]">{{ row.title }}</span>
                  <span class="tabular block text-[11px] text-ink-soft">{{ row.date }}</span>
                </span>
                <span class="tabular shrink-0 text-[12px]" [style.color]="row.colour">
                  {{ row.days }}
                </span>
              </li>
            } @empty {
              <li class="text-[13px] text-ink-soft">Every deadline has a plan.</li>
            }
          </ul>
          <a routerLink="/schedule" class="mt-3 inline-block text-[12px] text-accent-bright no-underline hover:underline">
            Open the schedule
          </a>
        </div>
      </aside>
    </section>
  `,
})
export class Calendar {
  private readonly store = inject(RegistryStore);

  protected readonly dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly kinds = [
    { key: 'DEADLINE' as const, label: 'Deadlines', colour: KIND_COLOUR.DEADLINE },
    { key: 'PLANNED' as const, label: 'Planned', colour: KIND_COLOUR.PLANNED },
    { key: 'DONE' as const, label: 'Done', colour: KIND_COLOUR.DONE },
  ];

  private readonly cursor = signal(today());
  protected readonly selected = signal<string | null>(null);
  protected readonly enabled = signal<EventKind[]>(['DEADLINE', 'PLANNED', 'DONE']);

  protected readonly selectedKey = computed(() => {
    const c = this.cursor();
    return `${c.getUTCFullYear()}-${c.getUTCMonth()}`;
  });

  /** Every tracked event, from three different sources. */
  private readonly allEvents = computed<CalEvent[]>(() => {
    const now = today().getTime();
    const out: CalEvent[] = [];

    // 1. deadlines we do not control
    for (const entry of this.store.cyclesInUse()) {
      const date = parseDate(entry.cycle.eolDate);
      if (!date) {
        continue;
      }
      const environments = this.store.deploymentsUsing(entry.cycle).length;
      out.push({
        id: `eol-${entry.cycle.id}`,
        kind: 'DEADLINE',
        date,
        title: `${entry.cycle.technology} ${entry.cycle.cycle} ends`,
        sub: `support ends · ${environments} environment(s)`,
        colour: KIND_COLOUR.DEADLINE,
        overdue: date.getTime() <= now,
      });
    }

    // 2. work we planned
    for (const action of this.store.actions()) {
      const planned = parseDate(action.plannedDate);
      if (planned && action.status !== 'COMPLETED') {
        out.push({
          id: `plan-${action.id}`,
          kind: 'PLANNED',
          date: planned,
          title: `${action.technology} ${action.cycle} → ${action.targetVersion}`,
          sub: `${action.jiraKey} · ${action.assignee} · ${action.status.toLowerCase().replace('_', ' ')}`,
          colour: KIND_COLOUR.PLANNED,
          overdue: planned.getTime() < now,
        });
      }

      const done = parseDate(action.completedDate);
      if (done) {
        out.push({
          id: `done-${action.id}`,
          kind: 'DONE',
          date: done,
          title: `${action.technology} ${action.cycle} → ${action.targetVersion}`,
          sub: `${action.jiraKey} · completed by ${action.assignee}`,
          colour: KIND_COLOUR.DONE,
          overdue: false,
        });
      }
    }

    // 3. what the revision history actually records
    for (const change of this.store.changeEvents()) {
      if (change.kind !== 'UPGRADE') {
        continue;
      }
      out.push({
        id: `chg-${change.deploymentId}-${change.technology}-${change.at.getTime()}`,
        kind: 'DONE',
        date: new Date(
          Date.UTC(
            change.at.getUTCFullYear(),
            change.at.getUTCMonth(),
            change.at.getUTCDate(),
          ),
        ),
        title: `${change.technology} upgraded`,
        sub: `recorded on ${change.deploymentId}`,
        colour: KIND_COLOUR.DONE,
        overdue: false,
      });
    }

    return out;
  });

  protected readonly events = computed(() =>
    this.allEvents().filter((e) => this.enabled().includes(e.kind)),
  );

  protected countOf(kind: EventKind): number {
    return this.allEvents().filter((e) => e.kind === kind).length;
  }

  protected readonly monthSummary = computed(() => {
    const cursor = this.cursor();
    const inMonth = this.allEvents().filter(
      (e) =>
        e.date.getUTCFullYear() === cursor.getUTCFullYear() &&
        e.date.getUTCMonth() === cursor.getUTCMonth(),
    );
    const count = (kind: EventKind) => inMonth.filter((e) => e.kind === kind).length;
    const overdue = this.allEvents().filter(
      (e) => e.kind === 'PLANNED' && e.overdue,
    ).length;

    const parts = [
      `${count('DEADLINE')} deadline(s)`,
      `${count('PLANNED')} planned`,
      `${count('DONE')} done`,
    ];
    return overdue
      ? `${parts.join(' · ')} — ${overdue} planned upgrade(s) overdue`
      : parts.join(' · ');
  });

  protected readonly bands = computed(() => {
    const start = today();

    return Array.from({ length: 24 }, (_, i) => {
      const ms = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1);
      const d = new Date(ms);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const inMonth = this.allEvents().filter(
        (e) => e.date.getUTCFullYear() === year && e.date.getUTCMonth() === month,
      );

      return {
        key: `${year}-${month}`,
        year,
        month,
        label: d.toLocaleDateString('en-GB', {
          month: 'short',
          year: '2-digit',
          timeZone: 'UTC',
        }),
        deadlines: inMonth.filter((e) => e.kind === 'DEADLINE').length,
        planned: inMonth.filter((e) => e.kind === 'PLANNED').length,
      };
    });
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
    const offset = (first.getUTCDay() + 6) % 7;
    const now = today().getTime();

    const cells: Day[] = [];
    for (let i = 0; i < offset; i++) {
      cells.push({ date: null, key: `pad-${i}`, events: [], isToday: false, isSelected: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month, day));
      const key = date.toISOString().slice(0, 10);
      cells.push({
        date,
        key,
        isToday: date.getTime() === now,
        isSelected: this.selected() === key,
        events: this.events()
          .filter((e) => e.date.getTime() === date.getTime())
          .sort((a, b) => a.kind.localeCompare(b.kind)),
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({
        date: null,
        key: `pad-end-${cells.length}`,
        events: [],
        isToday: false,
        isSelected: false,
      });
    }

    const weeks: Day[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  });

  /** The selected day, or the next 60 days when nothing is selected. */
  protected readonly agenda = computed(() => {
    const key = this.selected();
    const events = this.events()
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (key) {
      return events.filter((e) => e.date.toISOString().slice(0, 10) === key);
    }

    const now = today().getTime();
    const horizon = now + 60 * 86_400_000;
    return events.filter((e) => e.date.getTime() >= now && e.date.getTime() <= horizon);
  });

  protected readonly dayHeading = computed(() => {
    const key = this.selected();
    return key
      ? new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : '';
  });

  /** Deadlines with no open action — the gap this tool exists to surface. */
  protected readonly unplanned = computed(() =>
    this.store
      .cyclesInUse()
      .filter(({ cycle }) => !this.store.actionFor(cycle))
      .filter(({ status }) => status === 'EOL' || status === 'NEAR')
      .map(({ cycle, days, status }) => ({
        id: cycle.id,
        title: `${cycle.technology} ${cycle.cycle}`,
        date: formatDate(cycle.eolDate),
        days: formatDays(days),
        colour: statusFill(status),
      })),
  );

  protected toggle(kind: EventKind): void {
    this.enabled.update((all) =>
      all.includes(kind) ? all.filter((k) => k !== kind) : [...all, kind],
    );
  }

  protected shift(months: number): void {
    const c = this.cursor();
    this.cursor.set(new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + months, 1)));
    this.selected.set(null);
  }

  protected goToday(): void {
    this.cursor.set(today());
    this.selected.set(null);
  }

  protected pick(year: number, month: number): void {
    this.cursor.set(new Date(Date.UTC(year, month, 1)));
    this.selected.set(null);
  }

  protected select(day: Day): void {
    this.selected.set(this.selected() === day.key ? null : day.key);
  }

  protected dayLabel(day: Day): string {
    return day.date
      ? `${day.date.getUTCDate()} ${this.monthLabel()}, ${day.events.length} event(s)`
      : '';
  }

  /** A faint wash of the event colour, so chips read as tinted, not painted. */
  protected tint(colour: string): string {
    return `color-mix(in oklab, ${colour} 14%, transparent)`;
  }

  protected shortDate(date: Date): string {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
  }
}
