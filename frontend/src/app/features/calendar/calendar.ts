import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { Api, ApiActivity, ApiTimeLog } from '../../core/api';
import { formatDays } from '../../core/lifecycle';
import { humanGap } from '../../core/relative-time';
import { RegistryStore } from '../../core/registry.store';
import { TechIcon } from '../../shared/tech-icon';

type Kind = 'DEADLINE' | 'PLAN' | 'TASK' | 'DONE' | 'TIME';
type View = 'month' | 'agenda';

interface Entry {
  id: string;
  kind: Kind;
  date: string;
  technology: string;
  title: string;
  meta: string;
  seconds: number;
  person: string | null;
  link: string | null;
  initial: boolean;
}

interface Day {
  iso: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  weekend: boolean;
  entries: Entry[];
  seconds: number;
}

const KINDS: { key: Kind; label: string; colour: string }[] = [
  { key: 'DEADLINE', label: 'End of support', colour: 'var(--color-overdue)' },
  { key: 'PLAN', label: 'Plan due', colour: 'var(--primary)' },
  { key: 'TASK', label: 'Sub-task due', colour: 'oklch(0.62 0.17 255)' },
  { key: 'DONE', label: 'Version change', colour: 'var(--color-good)' },
  { key: 'TIME', label: 'Time logged', colour: 'oklch(0.58 0.2 292)' },
];

const COLOUR = Object.fromEntries(KINDS.map((k) => [k.key, k.colour])) as Record<Kind, string>;
const LABEL = Object.fromEntries(KINDS.map((k) => [k.key, k.label])) as Record<Kind, string>;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY = 86_400_000;

@Component({
  selector: 'lime-calendar',
  imports: [HlmButton, HlmCardImports, NgTemplateOutlet, RouterLink, TechIcon],
  host: { class: 'block' },
  template: `
    <header class="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-3xl font-semibold tracking-tight">
          Calendar
          @if (store.activeProject(); as p) {
            <span class="font-normal text-muted-foreground">· {{ p.customer }} {{ p.name }}</span>
          }
        </h1>
        <p class="m-0 mt-1 text-sm text-muted-foreground">End-of-support dates, plans, sub-tasks, version changes and time logged.</p>
      </div>
      <div class="segmented" role="tablist" aria-label="View">
        @for (v of views; track v.key) {
          <button
            type="button"
            role="tab"
            class="px-4 py-1 text-[13px]"
            [attr.aria-selected]="view() === v.key"
            [class.bg-background]="view() === v.key"
            [class.shadow-sm]="view() === v.key"
            [class.text-foreground]="view() === v.key"
            [class.text-ink-soft]="view() !== v.key"
            (click)="view.set(v.key)"
          >{{ v.label }}</button>
        }
      </div>
    </header>

    <section class="mb-4 flex flex-wrap items-center gap-2">
      @if (view() === 'month') {
        <button type="button" hlmBtn variant="ghost" size="sm" aria-label="Previous month" (click)="shift(-1)">‹</button>
        <span class="min-w-[140px] text-center text-[15px] font-semibold">{{ monthLabel() }}</span>
        <button type="button" hlmBtn variant="ghost" size="sm" aria-label="Next month" (click)="shift(1)">›</button>
        <button type="button" hlmBtn variant="outline" size="sm" (click)="goToday()">Today</button>
      }
      <span class="ml-auto flex flex-wrap items-center gap-1.5">
        @for (k of kinds; track k.key) {
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] transition-opacity"
            [attr.aria-pressed]="enabled().has(k.key)"
            [style.opacity]="enabled().has(k.key) ? 1 : 0.45"
            [style.border-color]="enabled().has(k.key) ? tint(k.colour, 45) : null"
            (click)="toggle(k.key)"
          >
            <span class="size-2 rounded-full" [style.background]="k.colour"></span>
            {{ k.label }}
            <span class="tabular text-muted-foreground">{{ k.key === 'TIME' ? hours(scopeSeconds()) : scopeCount(k.key) }}</span>
          </button>
        }
        <label class="ml-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <input type="checkbox" [checked]="showInitial()" (change)="showInitial.set(!showInitial())" />
          Initial records
        </label>
      </span>
    </section>

    <div class="grid gap-4 lg:grid-cols-[1fr_300px]">
      @if (view() === 'month') {
        <section hlmCard class="gap-0 overflow-hidden py-0">
          <div class="grid grid-cols-7 border-b bg-muted/40 text-center text-[12px] text-muted-foreground">
            @for (d of weekdays; track d) {
              <div class="py-2">{{ d }}</div>
            }
          </div>
          <div class="grid grid-cols-7">
            @for (d of grid(); track d.iso) {
              <button
                type="button"
                class="flex min-h-[104px] flex-col gap-1 border-r border-b p-1.5 text-left align-top transition-colors hover:bg-muted/50 [&:nth-child(7n)]:border-r-0"
                [style.background]="d.weekend && d.inMonth ? 'color-mix(in oklab, var(--muted) 45%, transparent)' : null"
                [style.opacity]="d.inMonth ? 1 : 0.45"
                [style.box-shadow]="selected() === d.iso ? 'inset 0 0 0 2px var(--primary)' : null"
                [attr.aria-label]="dayLabel(d.iso) + ': ' + d.entries.length + ' entries'"
                (click)="select(d.iso)"
              >
                <span class="flex items-center justify-between">
                  <span
                    class="grid size-6 place-items-center rounded-full text-[12px] tabular"
                    [style.background]="d.today ? 'var(--primary)' : null"
                    [style.color]="d.today ? 'var(--primary-foreground)' : null"
                    [class.font-semibold]="d.today"
                  >{{ d.day }}</span>
                  @if (d.seconds) {
                    <span class="rounded px-1 text-[10.5px] tabular" [style.color]="colour.TIME" [style.background]="tint(colour.TIME, 12)">⏱ {{ hours(d.seconds) }}</span>
                  }
                </span>
                @for (e of d.entries.slice(0, 3); track e.id) {
                  <span
                    class="block truncate rounded border-l-2 px-1.5 py-0.5 text-[11px] leading-tight"
                    [style.border-color]="colour[e.kind]"
                    [style.background]="tint(colour[e.kind], 10)"
                    [title]="labels[e.kind] + ': ' + e.title"
                  >{{ e.title }}</span>
                }
                @if (d.entries.length > 3) {
                  <span class="text-[11px] text-muted-foreground">+{{ d.entries.length - 3 }} more</span>
                }
              </button>
            }
          </div>
        </section>
      } @else {
        <section class="grid gap-4">
          @for (g of upcoming(); track g.label) {
            <section hlmCard class="gap-0 py-0">
              <header class="flex items-baseline justify-between border-b px-5 py-3">
                <h2 class="m-0 text-[14px] font-semibold">{{ g.label }}</h2>
                <span class="text-[12px] text-muted-foreground">{{ g.entries.length }}</span>
              </header>
              <ul class="m-0 list-none p-0">
                @for (e of g.entries; track e.id) {
                  <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: e }" />
                }
              </ul>
            </section>
          } @empty {
            <p hlmCard class="block px-6 py-10 text-center text-muted-foreground">Nothing coming up.</p>
          }

          <button type="button" hlmBtn variant="outline" class="justify-self-start" (click)="showPast.set(!showPast())">
            {{ showPast() ? 'Hide past' : 'Show past (' + past().length + ')' }}
          </button>
          @if (showPast()) {
            @for (g of pastGroups(); track g.label) {
              <section hlmCard class="gap-0 py-0 opacity-90">
                <header class="flex items-baseline justify-between border-b px-5 py-3">
                  <h2 class="m-0 text-[14px] font-semibold text-muted-foreground">{{ g.label }}</h2>
                  <span class="text-[12px] text-muted-foreground">{{ g.entries.length }}</span>
                </header>
                <ul class="m-0 list-none p-0">
                  @for (e of g.entries; track e.id) {
                    <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: e }" />
                  }
                </ul>
              </section>
            }
          }
        </section>
      }

      <aside class="grid content-start gap-4">
        @if (selected(); as iso) {
          <section hlmCard class="gap-0 py-0">
            <header class="flex items-center justify-between border-b px-4 py-3">
              <h2 class="m-0 text-[14px] font-semibold">{{ dayLabel(iso) }}</h2>
              <button type="button" class="text-[12px] text-muted-foreground hover:text-foreground" (click)="selected.set(null)">Close</button>
            </header>
            <ul class="m-0 list-none p-0">
              @for (e of entriesOn(iso); track e.id) {
                <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: e }" />
              } @empty {
                <li class="px-4 py-6 text-center text-[13px] text-muted-foreground">Nothing on this day.</li>
              }
            </ul>
          </section>
        }

        <section hlmCard class="gap-0 py-0">
          <header class="border-b px-4 py-3">
            <h2 class="m-0 text-[14px] font-semibold">Next 30 days</h2>
          </header>
          <ul class="m-0 list-none p-0">
            @for (e of next30(); track e.id) {
              <li class="flex items-start gap-2.5 border-b px-4 py-2.5 text-[12.5px] last:border-b-0">
                <span class="mt-1 size-2 shrink-0 rounded-full" [style.background]="colour[e.kind]"></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium">{{ e.title }}</span>
                  <span class="block text-[11.5px] text-muted-foreground">{{ short(e.date) }} · {{ relative(e.date) }}</span>
                </span>
              </li>
            } @empty {
              <li class="px-4 py-5 text-center text-[12.5px] text-muted-foreground">Nothing in the next 30 days.</li>
            }
          </ul>
        </section>

        <section hlmCard class="gap-0 py-0">
          <header class="flex items-baseline justify-between border-b px-4 py-3">
            <h2 class="m-0 text-[14px] font-semibold">Time logged · {{ monthName() }}</h2>
            <span class="text-[12px] tabular" [style.color]="colour.TIME">{{ hours(monthSeconds()) }}</span>
          </header>
          <ul class="m-0 list-none p-0">
            @for (p of people(); track p.name) {
              <li class="flex items-center gap-2 border-b px-4 py-2 text-[12.5px] last:border-b-0">
                <span class="flex-1">{{ p.name }}</span>
                <span class="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <span class="block h-full rounded-full" [style.width.%]="(p.seconds / maxPerson()) * 100" [style.background]="colour.TIME"></span>
                </span>
                <span class="w-14 text-right tabular">{{ hours(p.seconds) }}</span>
              </li>
            } @empty {
              <li class="px-4 py-5 text-center text-[12.5px] text-muted-foreground">No time logged this month.</li>
            }
          </ul>
        </section>
      </aside>
    </div>

    <ng-template #row let-e>
      <li class="flex items-start gap-3 border-b px-4 py-2.5 last:border-b-0">
        <span class="w-[46px] shrink-0 pt-0.5 text-[11.5px] text-muted-foreground tabular">{{ short(e.date) }}</span>
        <lime-tech-icon [technology]="e.technology" [size]="18" />
        <span class="min-w-0 flex-1">
          <span class="block text-[13px]">
            @if (e.link) {
              <a [routerLink]="e.link" class="font-medium hover:underline">{{ e.title }}</a>
            } @else {
              <span class="font-medium">{{ e.title }}</span>
            }
          </span>
          <span class="block text-[11.5px] text-muted-foreground">{{ e.meta }}</span>
        </span>
        <span class="shrink-0 rounded-full border px-2 py-0.5 text-[10.5px]" [style.color]="kindColour(e.kind)" [style.border-color]="tint(kindColour(e.kind), 40)">{{ kindLabel(e.kind) }}</span>
      </li>
    </ng-template>
  `,
})
export class Calendar {
  private readonly api = inject(Api);
  protected readonly store = inject(RegistryStore);

  protected readonly kinds = KINDS;
  protected readonly colour = COLOUR;
  protected readonly labels = LABEL;
  protected readonly weekdays = WEEKDAYS;
  protected readonly views: { key: View; label: string }[] = [
    { key: 'month', label: 'Month' },
    { key: 'agenda', label: 'Agenda' },
  ];

  readonly month = input<string>('');
  readonly start = input<string>('', { alias: 'view' });

  protected readonly view = signal<View>('month');
  protected readonly enabled = signal(new Set<Kind>(KINDS.map((k) => k.key)));
  protected readonly showInitial = signal(false);
  protected readonly showPast = signal(false);
  protected readonly selected = signal<string | null>(null);
  protected readonly anchor = signal(firstOfMonth(todayIso()));

  private readonly recorded = signal<ApiActivity[]>([]);
  private readonly logged = signal<ApiTimeLog[]>([]);

  constructor() {
    effect(() => {
      const month = this.month();
      if (/^\d{4}-\d{2}$/.test(month)) this.anchor.set(`${month}-01`);
      if (this.start() === 'agenda' || this.start() === 'month') this.view.set(this.start() as View);
    });

    const from = shiftIso(todayIso(), -365);
    const to = shiftIso(todayIso(), 1);
    this.api.timeLog(from, to).subscribe({ next: (rows) => this.logged.set(rows), error: () => this.logged.set([]) });

    effect(() => {
      const scoped = this.store.activeProject();
      const ids = scoped ? [scoped.id] : this.store.projects().map((p) => p.id);
      if (ids.length === 0) {
        this.recorded.set([]);
        return;
      }
      Promise.all(
        ids.map(
          (id) =>
            new Promise<ApiActivity[]>((resolve) =>
              this.api.activity(id).subscribe({ next: resolve, error: () => resolve([]) }),
            ),
        ),
      ).then((results) => this.recorded.set(results.flat()));
    });
  }

  private readonly scopedPlans = computed(() => {
    const project = this.store.activeProject();
    const plans = this.api.actions();
    return project ? plans.filter((a) => a.environments.some((e) => e.projectId === project.id)) : plans;
  });

  private readonly all = computed<Entry[]>(() => {
    const out: Entry[] = [];

    for (const entry of this.store.cyclesInUse()) {
      if (!entry.cycle.eolDate) continue;
      const environments = this.store.deploymentsUsing(entry.cycle).length;
      out.push({
        id: `eol-${entry.cycle.id}`,
        kind: 'DEADLINE',
        date: entry.cycle.eolDate,
        technology: entry.cycle.technology,
        title: `${entry.cycle.technology} ${entry.cycle.cycle} support ends`,
        meta: `${environments} environment${environments === 1 ? '' : 's'} · ${
          entry.days !== null && entry.days <= 0 ? `ended ${humanGap(entry.days)} ago` : formatDays(entry.days) + ' left'
        }`,
        seconds: 0,
        person: null,
        link: '/lifecycle',
        initial: false,
      });
    }

    for (const plan of this.scopedPlans()) {
      if (plan.plannedDate && plan.status !== 'COMPLETED') {
        out.push({
          id: `plan-${plan.id}`,
          kind: 'PLAN',
          date: plan.plannedDate,
          technology: plan.technology,
          title: `${plan.technology} ${plan.cycle}${plan.targetVersion ? ' → ' + plan.targetVersion : ''}`,
          meta: [plan.jiraKey, plan.assignee?.name, plan.status.toLowerCase().replace('_', ' ')].filter(Boolean).join(' · '),
          seconds: 0,
          person: null,
          link: '/plan',
          initial: false,
        });
      }
      for (const task of plan.subtasks ?? []) {
        const date = task.dueDate ?? task.startDate;
        if (!date || task.statusCategory === 'done') continue;
        out.push({
          id: `task-${plan.id}-${task.key}`,
          kind: 'TASK',
          date,
          technology: plan.technology,
          title: `${task.key} · ${task.summary}`,
          meta: [task.assignee ?? 'unassigned', task.status, `${plan.technology} ${plan.cycle} plan`].join(' · '),
          seconds: 0,
          person: null,
          link: '/plan',
          initial: false,
        });
      }
    }

    for (const change of this.recorded()) {
      out.push({
        id: `done-${change.id}`,
        kind: 'DONE',
        date: change.date.slice(0, 10),
        technology: change.technology,
        title: change.fromVersion
          ? `${change.technology} ${change.fromVersion} → ${change.toVersion}`
          : `${change.technology} ${change.toVersion} installed`,
        meta: [change.environment, change.reason.toLowerCase().replace(/_/g, ' '), change.ticketRef, change.recordedBy]
          .filter(Boolean)
          .join(' · '),
        seconds: 0,
        person: null,
        link: null,
        initial: change.reason === 'INITIAL_RECORD',
      });
    }

    const planIds = new Set(this.scopedPlans().map((p) => p.id));
    for (const log of this.logged()) {
      if (!planIds.has(log.planId)) continue;
      out.push({
        id: `time-${log.id}`,
        kind: 'TIME',
        date: log.started.slice(0, 10),
        technology: log.technology,
        title: `${hours(log.seconds)} on ${log.issueKey} · ${log.summary}`,
        meta: [log.author, log.comment].filter(Boolean).join(' · '),
        seconds: log.seconds,
        person: log.author,
        link: '/plan',
        initial: false,
      });
    }

    return out.sort((a, b) => a.date.localeCompare(b.date));
  });

  protected readonly entries = computed(() =>
    this.all().filter((e) => this.enabled().has(e.kind) && (this.showInitial() || !e.initial)),
  );

  protected readonly monthLabel = computed(() => {
    const d = new Date(`${this.anchor()}T00:00:00Z`);
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  });

  protected readonly monthName = computed(() =>
    new Date(`${this.anchor()}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }),
  );

  private inMonth(iso: string): boolean {
    return iso.slice(0, 7) === this.anchor().slice(0, 7);
  }

  protected readonly grid = computed<Day[]>(() => {
    const first = new Date(`${this.anchor()}T00:00:00Z`);
    const start = first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY;
    const lastOfMonth = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0);
    const end = lastOfMonth + (6 - ((new Date(lastOfMonth).getUTCDay() + 6) % 7)) * DAY;
    const today = todayIso();
    const byDay = new Map<string, Entry[]>();
    for (const e of this.entries()) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

    const days: Day[] = [];
    for (let t = start; t <= end; t += DAY) {
      const iso = new Date(t).toISOString().slice(0, 10);
      const list = byDay.get(iso) ?? [];
      const weekday = new Date(t).getUTCDay();
      days.push({
        iso,
        day: new Date(t).getUTCDate(),
        inMonth: this.inMonth(iso),
        today: iso === today,
        weekend: weekday === 0 || weekday === 6,
        entries: list.filter((e) => e.kind !== 'TIME'),
        seconds: list.filter((e) => e.kind === 'TIME').reduce((s, e) => s + e.seconds, 0),
      });
    }
    return days;
  });

  protected readonly scope = computed(() => {
    if (this.view() === 'month') return this.all().filter((e) => this.inMonth(e.date));
    const today = todayIso();
    return this.all().filter((e) => e.date >= today);
  });

  protected scopeCount(kind: Kind): number {
    return this.scope().filter((e) => e.kind === kind && (this.showInitial() || !e.initial)).length;
  }

  protected readonly scopeSeconds = computed(() =>
    this.scope().filter((e) => e.kind === 'TIME').reduce((s, e) => s + e.seconds, 0),
  );

  protected readonly upcoming = computed(() => {
    const today = todayIso();
    const weekStart = mondayOf(today);
    const thisWeekEnd = shiftIso(weekStart, 6);
    const nextWeekEnd = shiftIso(weekStart, 13);
    const monthEnd = lastOfMonth(today);
    const groups = new Map<string, Entry[]>();
    const order: string[] = [];
    for (const e of this.entries().filter((x) => x.date >= today)) {
      const label =
        e.date <= thisWeekEnd
          ? 'This week'
          : e.date <= nextWeekEnd
            ? 'Next week'
            : e.date <= monthEnd
              ? 'Later this month'
              : new Date(`${e.date}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      if (!groups.has(label)) order.push(label);
      groups.set(label, [...(groups.get(label) ?? []), e]);
    }
    return order.map((label) => ({ label, entries: groups.get(label)! }));
  });

  protected readonly past = computed(() => this.entries().filter((e) => e.date < todayIso()).reverse());

  protected readonly pastGroups = computed(() => {
    const groups = new Map<string, Entry[]>();
    for (const e of this.past()) {
      const label = new Date(`${e.date}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      groups.set(label, [...(groups.get(label) ?? []), e]);
    }
    return [...groups.entries()].map(([label, entries]) => ({ label, entries }));
  });

  protected readonly next30 = computed(() => {
    const today = todayIso();
    const limit = shiftIso(today, 30);
    return this.entries()
      .filter((e) => e.kind !== 'TIME' && e.date >= today && e.date <= limit)
      .slice(0, 6);
  });

  protected readonly monthSeconds = computed(() =>
    this.all()
      .filter((e) => e.kind === 'TIME' && this.inMonth(e.date))
      .reduce((s, e) => s + e.seconds, 0),
  );

  protected readonly people = computed(() => {
    const totals = new Map<string, number>();
    for (const e of this.all()) {
      if (e.kind !== 'TIME' || !this.inMonth(e.date) || !e.person) continue;
      totals.set(e.person, (totals.get(e.person) ?? 0) + e.seconds);
    }
    return [...totals.entries()].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds);
  });

  protected readonly maxPerson = computed(() => Math.max(1, ...this.people().map((p) => p.seconds)));

  protected entriesOn(iso: string): Entry[] {
    return this.entries().filter((e) => e.date === iso);
  }

  protected toggle(kind: Kind): void {
    const next = new Set(this.enabled());
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    this.enabled.set(next);
  }

  protected shift(months: number): void {
    const d = new Date(`${this.anchor()}T00:00:00Z`);
    this.anchor.set(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)).toISOString().slice(0, 10));
    this.selected.set(null);
  }

  protected goToday(): void {
    this.anchor.set(firstOfMonth(todayIso()));
    this.selected.set(todayIso());
  }

  protected select(iso: string): void {
    this.selected.set(this.selected() === iso ? null : iso);
    if (!this.inMonth(iso)) this.anchor.set(firstOfMonth(iso));
  }

  protected kindColour(kind: string): string {
    return COLOUR[kind as Kind] ?? 'var(--muted-foreground)';
  }

  protected kindLabel(kind: string): string {
    return LABEL[kind as Kind] ?? kind;
  }

  protected tint(colour: string, percent: number): string {
    return `color-mix(in oklab, ${colour} ${percent}%, transparent)`;
  }

  protected hours(seconds: number): string {
    return hours(seconds);
  }

  protected dayLabel(iso: string): string {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  protected short(iso: string): string {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  protected relative(iso: string): string {
    const days = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / DAY);
    return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  }
}

function hours(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function todayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

function shiftIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

function firstOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function lastOfMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return shiftIso(iso, -((d.getUTCDay() + 6) % 7));
}
