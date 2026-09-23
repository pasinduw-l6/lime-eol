import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Api, ApiActivity } from '../../core/api';
import { formatDays, parseDate, statusFill, today } from '../../core/lifecycle';
import { humanGap } from '../../core/relative-time';
import { RegistryStore } from '../../core/registry.store';
import { TechIcon } from '../../shared/tech-icon';

type Kind = 'DEADLINE' | 'PLANNED' | 'DONE';

interface Entry {
  id: string;
  kind: Kind;
  date: Date;
  day: string;
  technology: string;
  title: string;
  meta: string;
  colour: string;
  past: boolean;
}

interface MonthGroup {
  key: string;
  label: string;
  entries: Entry[];
}

const KIND_COLOUR: Record<Kind, string> = {
  DEADLINE: 'var(--color-overdue)',
  PLANNED: 'var(--color-accent-bright)',
  DONE: 'var(--color-good)',
};

const KIND_LABEL: Record<Kind, string> = {
  DEADLINE: 'deadline',
  PLANNED: 'planned',
  DONE: 'done',
};

/**
 * Calendar, as an agenda.
 *
 * A month grid is built for dense daily events; lifecycle work is a handful a
 * year, so a grid would be mostly empty cells. This lists only months that
 * contain something and names the quiet stretches between them — an empty
 * quarter is information, not blank space.
 */
@Component({
  selector: 'lime-calendar',
  imports: [NgTemplateOutlet, TechIcon],
  host: { class: 'block' },
  template: `
    <header class="card mb-5 px-7 py-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="m-0 text-[30px] font-semibold tracking-[-0.02em]">Calendar</h1>
          <p class="m-0 text-[14px] text-ink-soft">
            {{ summary() }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          @for (k of kinds; track k.key) {
            <button
              type="button"
              class="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px]"
              [class.border-rule]="!enabled().includes(k.key)"
              [class.text-ink-faint]="!enabled().includes(k.key)"
              [style.border-color]="enabled().includes(k.key) ? k.colour : null"
              [style.color]="enabled().includes(k.key) ? k.colour : null"
              [attr.aria-pressed]="enabled().includes(k.key)"
              (click)="toggle(k.key)"
            >
              <span class="h-2 w-2 rounded-full" [style.background]="k.colour"></span>
              {{ k.label }}
              <span class="tabular text-[12px]">{{ countOf(k.key) }}</span>
            </button>
          }
        </div>
      </div>
    </header>

    <!-- One definition, used above a month heading, between two rows, or at the
         end — so the line looks identical wherever now happens to fall. -->
    <ng-template #todayLine let-trailing="trailing">
      <div class="flex items-center gap-3 py-3">
        <span
          class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] uppercase"
          style="background: var(--color-accent); color: var(--color-ground)"
        >
          Today
        </span>
        <span class="tabular text-[12px] text-ink-soft">{{ todayLabel }}</span>
        <span class="h-px flex-1" style="background: var(--color-accent); opacity: 0.45"></span>
        @if (trailing) {
          <span class="text-[12px] text-ink-faint">nothing scheduled ahead</span>
        }
      </div>
    </ng-template>

    <section class="card px-7 py-6">
      @for (group of groups(); track group.key) {
        <!-- Today belongs above the heading when the month's own first entry is
             what comes next: under it, the line reads as though today fell in
             that month. -->
        @if (group.entries[0].id === todayMarker()) {
          <ng-container [ngTemplateOutlet]="todayLine" />
        }

        <!-- month heading, with a rule running to the count -->
        <div class="mt-7 mb-1 flex items-baseline gap-3 first:mt-0">
          <h2 class="m-0 text-[13px] font-semibold tracking-[0.04em] uppercase">
            {{ group.label }}
          </h2>
          <span class="h-px flex-1" style="background: var(--color-rule)"></span>
          <span class="tabular text-[12px] text-ink-soft">
            {{ group.entries.length }}
            {{ group.entries.length === 1 ? 'activity' : 'activities' }}
          </span>
        </div>

        <ol class="m-0 list-none p-0">
          @for (entry of group.entries; track entry.id) {
            <!-- $first is already handled above the heading. -->
            @if (entry.id === todayMarker() && !$first) {
              <li>
                <ng-container [ngTemplateOutlet]="todayLine" />
              </li>
            }

            <li
              class="agenda-row flex items-center gap-4 border-b border-rule py-3 last:border-b-0"
              [style.animation-delay.ms]="$index * 35"
            >
              <span
                class="tabular w-[28px] shrink-0 text-right text-[15px]"
                [class.text-ink-faint]="entry.past"
              >
                {{ entry.day }}
              </span>

              <lime-tech-icon [technology]="entry.technology" [size]="20" />

              <span class="min-w-0 flex-1">
                <span class="block truncate text-[14px]" [class.text-ink-soft]="entry.past">
                  {{ entry.title }}
                </span>
                <span class="block truncate text-[12px] text-ink-soft">{{ entry.meta }}</span>
              </span>

              <span
                class="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px]"
                [style.border-color]="entry.colour"
                [style.color]="entry.colour"
              >
                {{ label(entry.kind) }}
              </span>
            </li>
          }
        </ol>
      } @empty {
        <p class="m-0 py-10 text-center text-[14px] text-ink-soft">
          Nothing recorded or scheduled. Record a version change on an
          environment and it will appear here.
        </p>
      }

      @if (nothingAhead()) {
        <ng-container
          [ngTemplateOutlet]="todayLine"
          [ngTemplateOutletContext]="{ trailing: true }"
        />
      }
    </section>
  `,
  styles: `
    .agenda-row {
      animation: agenda-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes agenda-in {
      from {
        opacity: 0;
        transform: translateY(5px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class Calendar {
  private readonly api = inject(Api);
  private readonly store = inject(RegistryStore);

  protected readonly kinds = [
    { key: 'DEADLINE' as const, label: 'Deadlines', colour: KIND_COLOUR.DEADLINE },
    { key: 'PLANNED' as const, label: 'Planned', colour: KIND_COLOUR.PLANNED },
    { key: 'DONE' as const, label: 'Done', colour: KIND_COLOUR.DONE },
  ];

  protected readonly enabled = signal<Kind[]>(['DEADLINE', 'PLANNED', 'DONE']);
  private readonly recorded = signal<ApiActivity[]>([]);

  constructor() {
    // Projects arrive asynchronously and the scope switcher can change which
    // ones are in view, so the fetch is reactive rather than a one-shot in the
    // constructor — which would run before any project id existed.
    effect(() => {
      const scoped = this.store.activeProject();
      const ids = scoped
        ? [scoped.id]
        : this.store.projects().map((project) => project.id);

      if (ids.length === 0) {
        this.recorded.set([]);
        return;
      }

      // One call per project in scope — usually one, since engineers work
      // inside a single customer installation.
      Promise.all(
        ids.map(
          (id) =>
            new Promise<ApiActivity[]>((resolve) => {
              this.api.activity(id).subscribe({
                next: resolve,
                error: () => resolve([]),
              });
            }),
        ),
      ).then((results) => this.recorded.set(results.flat()));
    });
  }

  /** Everything, from three sources, on one timeline. */
  private readonly all = computed<Entry[]>(() => {
    const now = today().getTime();
    const out: Entry[] = [];

    // what has already been done
    for (const change of this.recorded()) {
      const date = parseDate(change.date);
      if (!date) {
        continue;
      }
      out.push({
        id: `done-${change.id}`,
        kind: 'DONE',
        date,
        day: String(date.getUTCDate()).padStart(2, '0'),
        technology: change.technology,
        title: change.fromVersion
          ? `${change.technology} ${change.fromVersion} → ${change.toVersion}`
          : `${change.technology} ${change.toVersion} installed`,
        meta: [
          change.environment,
          change.reason.toLowerCase().replace(/_/g, ' '),
          change.ticketRef,
          change.recordedBy ? `by ${change.recordedBy}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        colour: KIND_COLOUR.DONE,
        past: true,
      });
    }

    // what is planned
    for (const action of this.store.actions()) {
      const date = parseDate(action.plannedDate);
      if (!date || action.status === 'COMPLETED') {
        continue;
      }
      out.push({
        id: `plan-${action.id}`,
        kind: 'PLANNED',
        date,
        day: String(date.getUTCDate()).padStart(2, '0'),
        technology: action.technology,
        title: `${action.technology} ${action.cycle} → ${action.targetVersion}`,
        meta: [action.jiraKey, action.assignee, action.status.toLowerCase().replace('_', ' ')]
          .filter(Boolean)
          .join(' · '),
        colour: KIND_COLOUR.PLANNED,
        past: date.getTime() < now,
      });
    }

    // what is coming whether we like it or not
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
        day: String(date.getUTCDate()).padStart(2, '0'),
        technology: entry.cycle.technology,
        title: `${entry.cycle.technology} ${entry.cycle.cycle} support ends`,
        meta: `${environments} environment${environments === 1 ? '' : 's'} · ${
          entry.days !== null && entry.days <= 0
            ? `unsupported for ${humanGap(entry.days)}`
            : formatDays(entry.days) + ' left'
        }`,
        colour: statusFill(entry.status),
        past: date.getTime() < now,
      });
    }

    return out.sort((a, b) => a.date.getTime() - b.date.getTime());
  });

  protected readonly visible = computed(() =>
    this.all().filter((e) => this.enabled().includes(e.kind)),
  );

  protected readonly todayLabel = today().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  /**
   * The entry the "today" line sits above — the first thing not yet behind us.
   *
   * Null when everything in view has already happened, in which case the line
   * is drawn after the last group instead, so the reader is never left
   * wondering which side of now they are on.
   */
  protected readonly todayMarker = computed(() => {
    const now = today().getTime();
    return this.visible().find((e) => e.date.getTime() >= now)?.id ?? null;
  });

  protected readonly nothingAhead = computed(
    () => this.visible().length > 0 && this.todayMarker() === null,
  );

  /** Grouped by month. Months with nothing in them are simply not listed. */
  protected readonly groups = computed<MonthGroup[]>(() => {
    const byMonth = new Map<string, Entry[]>();

    for (const entry of this.visible()) {
      const key = `${entry.date.getUTCFullYear()}-${String(entry.date.getUTCMonth()).padStart(2, '0')}`;
      byMonth.set(key, [...(byMonth.get(key) ?? []), entry]);
    }

    return [...byMonth.keys()].sort().map((key) => {
      const [year, month] = key.split('-').map(Number);
      return {
        key,
        label: monthName(year, month).toUpperCase(),
        entries: byMonth.get(key)!,
      };
    });
  });

  protected readonly summary = computed(() => {
    const all = this.all();
    const done = all.filter((e) => e.kind === 'DONE').length;
    const ahead = all.filter((e) => !e.past && e.kind !== 'DONE').length;
    return `${done} recorded · ${ahead} ahead · ${this.groups().length} months with activity`;
  });

  protected countOf(kind: Kind): number {
    return this.all().filter((e) => e.kind === kind).length;
  }

  protected toggle(kind: Kind): void {
    this.enabled.update((all) =>
      all.includes(kind) ? all.filter((k) => k !== kind) : [...all, kind],
    );
  }

  protected label(kind: Kind): string {
    return KIND_LABEL[kind];
  }
}

function monthName(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
