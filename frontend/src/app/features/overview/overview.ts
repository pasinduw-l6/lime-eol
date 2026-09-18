import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NOTICE_DAYS, formatDays, parseDate, statusFill, today } from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';

const BODY_H = 176;

interface Band {
  key: 'EOL' | 'NEAR' | 'SUPPORTED';
  label: string;
  count: number;
  share: number;
  colour: string;
  bars: number[];
}

interface Bucket {
  key: string;
  label: string;
  sub: string;
  count: number;
  height: number;
  colour: string;
  title: string;
}

/**
 * Overview.
 *
 * Three questions, one per panel, and deliberately not the same question
 * twice: when support ends, which customers carry the risk, and what needs a
 * decision today.
 */
@Component({
  selector: 'lime-overview',
  imports: [RouterLink],
  host: { class: 'block' },
  template: `
    <!-- headline -->
    <section class="card mb-5 px-7 py-6">
      <div class="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="m-0 text-[34px] font-semibold tracking-[-0.02em]">
            {{ activeProject()?.name ?? 'Lifecycle overview' }}
          </h1>
          <p class="m-0 text-[14px] text-ink-soft">
            @if (activeProject(); as project) {
              Lime {{ project.limeVersion }} · {{ deploymentCount() }} environments ·
              {{ engineerNames() }}
            } @else {
              {{ deploymentCount() }} environments across
              {{ projectCount() }} projects
            }
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
            <a routerLink="/projects" class="btn">Projects</a>
          </div>
        </div>

        <div class="grid gap-6 sm:grid-cols-3">
          @for (band of bands(); track band.key) {
            <div class="flex flex-col">
              <p class="tabular m-0 text-[22px] font-semibold">{{ band.count }}</p>
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

    <!-- three panels, equal thirds, each header / body / footer -->
    <div class="grid items-stretch gap-5 xl:grid-cols-3">
      <!-- 1. when support ends -->
      <section class="card grid grid-rows-[auto_1fr_auto] px-6 py-5">
        <header class="mb-4 flex items-baseline justify-between gap-3">
          <h2 class="m-0 text-[15px] font-semibold">Support ending</h2>
          <span class="text-[12px] text-ink-soft">next {{ horizon() }} months</span>
        </header>

        <div class="flex gap-3" [style.height.px]="bodyH">
          <!-- y axis -->
          <div
            class="tabular flex w-6 flex-col justify-between text-right text-[10px] text-ink-faint"
            aria-hidden="true"
          >
            @for (tick of yTicks(); track tick) {
              <span>{{ tick }}</span>
            }
          </div>

          <ol class="m-0 flex flex-1 list-none items-end gap-[3px] border-b border-rule p-0">
            @for (bucket of buckets(); track bucket.key) {
              <li class="flex h-full flex-1 flex-col justify-end" [attr.title]="bucket.title">
                @if (bucket.count > 0) {
                  <span
                    class="tabular mb-1 text-center text-[10px]"
                    [style.color]="bucket.colour"
                    >{{ bucket.count }}</span
                  >
                }
                <span
                  class="w-full rounded-t-[3px]"
                  [style.height.px]="bucket.height"
                  [style.background]="bucket.colour"
                  [style.opacity]="bucket.count ? 1 : 0.18"
                ></span>
              </li>
            }
          </ol>
        </div>

        <footer class="mt-2 flex justify-between pl-9 text-[10px] text-ink-faint">
          @for (bucket of buckets(); track bucket.key) {
            <span class="flex-1 text-center">{{ bucket.label }}</span>
          }
        </footer>
      </section>

      <!-- 2. who carries it -->
      <section class="card grid grid-rows-[auto_1fr_auto] px-6 py-5">
        <header class="mb-4 flex items-baseline justify-between gap-3">
          <h2 class="m-0 text-[15px] font-semibold">Risk by project</h2>
          <span class="text-[12px] text-ink-soft">components affected</span>
        </header>

        <ol class="m-0 flex list-none flex-col justify-start gap-3 p-0" [style.min-height.px]="bodyH">
          @for (row of projectRisk(); track row.id) {
            <li>
              <button
                type="button"
                class="block w-full text-left"
                (click)="focus(row.id)"
                [attr.aria-label]="'Focus ' + row.name"
              >
                <span class="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
                  <span class="truncate">{{ row.name }}</span>
                  <span class="tabular shrink-0 text-ink-soft">
                    Lime {{ row.limeVersion }}
                  </span>
                </span>
                <span class="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-elevated">
                  @if (row.eol > 0) {
                    <span
                      class="h-full rounded-full"
                      [style.width.%]="(row.eol / maxRisk()) * 100"
                      style="background: var(--color-overdue)"
                    ></span>
                  }
                  @if (row.near > 0) {
                    <span
                      class="h-full rounded-full"
                      [style.width.%]="(row.near / maxRisk()) * 100"
                      style="background: var(--color-soon)"
                    ></span>
                  }
                </span>
              </button>
            </li>
          } @empty {
            <li class="text-[13px] text-ink-soft">Nothing at risk in scope.</li>
          }
        </ol>

        <footer class="mt-3 flex items-center gap-4 border-t border-rule pt-3 text-[11px] text-ink-soft">
          <span class="flex items-center gap-1.5">
            <span class="inline-block h-2 w-3 rounded-full" style="background: var(--color-overdue)"></span>
            past EOL
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block h-2 w-3 rounded-full" style="background: var(--color-soon)"></span>
            within {{ noticeDays }}d
          </span>
        </footer>
      </section>

      <!-- 3. what to do -->
      <section class="card grid grid-rows-[auto_1fr_auto] px-6 py-5">
        <header class="mb-4 flex items-baseline justify-between gap-3">
          <h2 class="m-0 text-[15px] font-semibold">Needs you</h2>
          <span class="tabular text-[12px] text-ink-soft">{{ inbox().length }}</span>
        </header>

        <ul class="m-0 flex list-none flex-col p-0" [style.min-height.px]="bodyH">
          @for (item of inboxRows(); track item.id) {
            <li class="flex h-[52px] items-center gap-3 border-b border-rule last:border-b-0">
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                [style.background]="item.colour"
                aria-hidden="true"
              ></span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px]">{{ item.title }}</span>
                <span class="block truncate text-[11px] text-ink-soft">{{ item.sub }}</span>
              </span>
              <span class="tabular shrink-0 text-[12px]" [style.color]="item.colour">
                {{ item.days }}
              </span>
            </li>
          } @empty {
            <li class="py-3 text-[13px] text-ink-soft">Nothing needs attention.</li>
          }
        </ul>

        <footer class="mt-3 border-t border-rule pt-3">
          <a routerLink="/schedule" class="text-[12px] text-accent-bright no-underline hover:underline">
            Open the schedule
          </a>
        </footer>
      </section>
    </div>
  `,
})
export class Overview {
  private readonly store = inject(RegistryStore);
  private readonly router = inject(Router);

  protected readonly noticeDays = NOTICE_DAYS;
  protected readonly bodyH = BODY_H;
  protected readonly horizons = [6, 12, 24] as const;
  protected readonly horizon = signal<number>(12);
  protected readonly inbox = this.store.inbox;
  protected readonly activeProject = this.store.activeProject;

  protected readonly inUse = computed(() => this.store.cyclesInUse().length);
  protected readonly overdue = computed(
    () => this.store.cyclesInUse().filter((c) => c.status === 'EOL').length,
  );
  protected readonly nearCount = computed(
    () => this.store.cyclesInUse().filter((c) => c.status === 'NEAR').length,
  );
  protected readonly atRisk = computed(() => this.overdue() + this.nearCount());

  protected readonly deploymentCount = computed(() => this.store.deployments().length);
  protected readonly projectCount = computed(() => this.store.projects().length);

  protected readonly engineerNames = computed(() => {
    const project = this.activeProject();
    if (!project) {
      return '';
    }
    const names = this.store.engineersFor(project).map((e) => e.name);
    return names.length ? names.join(' and ') : 'unstaffed';
  });

  protected readonly bands = computed<Band[]>(() => {
    const all = this.store.cyclesInUse();
    const total = Math.max(1, all.length);

    const build = (key: Band['key'], label: string): Band => {
      const members = all.filter((c) => c.status === key);
      const bars = members.length
        ? members.map((_, i) => 100 - (i / Math.max(1, members.length)) * 55)
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

  /**
   * One column per month, plus a leading bucket for everything already past
   * end of life — otherwise the most urgent work is the one thing the chart
   * cannot show.
   */
  protected readonly buckets = computed<Bucket[]>(() => {
    const start = today();
    const months = this.horizon();
    const step = months > 12 ? 2 : 1;
    const dated = this.store
      .cyclesInUse()
      .map((c) => ({ cycle: c.cycle, date: parseDate(c.cycle.eolDate) }))
      .filter((e): e is { cycle: (typeof e)['cycle']; date: Date } => e.date !== null);

    const overdue = dated.filter((e) => e.date.getTime() <= start.getTime());
    const raw: { key: string; label: string; sub: string; count: number; names: string[]; colour: string }[] = [
      {
        key: 'past',
        label: 'past',
        sub: 'already ended',
        count: overdue.length,
        names: overdue.map((e) => `${e.cycle.technology} ${e.cycle.cycle}`),
        colour: 'var(--color-overdue)',
      },
    ];

    for (let i = 0; i < months; i += step) {
      const from = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1);
      const to = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + step, 1);
      const hits = dated.filter(
        (e) => e.date.getTime() >= from && e.date.getTime() < to && e.date.getTime() > start.getTime(),
      );
      const days = Math.round((from - start.getTime()) / 86_400_000);

      raw.push({
        key: `m${i}`,
        label: new Date(from).toLocaleDateString('en-GB', {
          month: 'short',
          timeZone: 'UTC',
        }),
        sub: new Date(from).toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        count: hits.length,
        names: hits.map((e) => `${e.cycle.technology} ${e.cycle.cycle}`),
        colour: days <= NOTICE_DAYS ? 'var(--color-soon)' : 'var(--color-accent)',
      });
    }

    const max = Math.max(1, ...raw.map((b) => b.count));

    return raw.map((b) => ({
      key: b.key,
      label: b.label,
      sub: b.sub,
      count: b.count,
      colour: b.colour,
      height: b.count ? Math.max(6, (b.count / max) * (BODY_H - 22)) : 3,
      title: b.count ? `${b.sub}: ${b.names.join(', ')}` : `${b.sub}: nothing ends`,
    }));
  });

  protected readonly yTicks = computed(() => {
    const max = Math.max(1, ...this.buckets().map((b) => b.count));
    return [max, Math.round(max / 2), 0];
  });

  /** Which customers actually carry the risk — the panel that replaced a heatmap. */
  protected readonly projectRisk = computed(() =>
    this.store
      .projects()
      .map((project) => ({
        id: project.id,
        name: project.name,
        limeVersion: project.limeVersion,
        ...this.store.riskOf(project.id),
      }))
      .filter((row) => row.eol > 0 || row.near > 0)
      .sort((a, b) => b.eol - a.eol || b.near - a.near)
      .slice(0, 5),
  );

  protected readonly maxRisk = computed(() =>
    Math.max(1, ...this.projectRisk().map((r) => r.eol + r.near)),
  );

  protected readonly inboxRows = computed(() =>
    this.inbox()
      .slice(0, 3)
      .map((item) => {
        const customers = [...new Set(item.deployments.map((d) => d.customer))];
        return {
          id: item.cycle.id,
          title: `${item.cycle.technology} ${item.cycle.cycle}`,
          sub: item.action
            ? `${item.action.jiraKey} · ${customers.length} customer(s)`
            : `no plan · ${customers.join(', ') || 'not deployed'}`,
          days: formatDays(item.days),
          colour: statusFill(
            item.days === null ? 'UNKNOWN' : item.days <= 0 ? 'EOL' : 'NEAR',
          ),
        };
      }),
  );

  protected focus(projectId: string): void {
    this.store.scope.set(projectId);
    void this.router.navigate(['/schedule']);
  }
}
