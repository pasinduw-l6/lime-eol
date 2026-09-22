import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NOTICE_DAYS, parseDate, statusFill, today } from '../../core/lifecycle';
import { humanGap } from '../../core/relative-time';
import { TechIcon } from '../../shared/tech-icon';
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
  imports: [RouterLink, TechIcon],
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
            <a
              [routerLink]="['/schedule']"
              [queryParams]="{ status: band.key }"
              class="flex flex-col rounded-xl p-2 -m-2 no-underline transition-colors hover:bg-elevated"
              [attr.aria-label]="'Show the ' + band.count + ' cycles ' + band.label"
            >
              <span class="tabular m-0 text-[22px] font-semibold text-ink">{{ band.count }}</span>
              <span class="m-0 mb-3 text-[13px]">
                <span [style.color]="band.colour">{{ band.share }}%</span>
                <span class="text-ink-soft"> {{ band.label }}</span>
              </span>
              <span class="flex h-[62px] items-end gap-[3px]" aria-hidden="true">
                @for (bar of band.bars; track $index) {
                  <span
                    class="flex-1 rounded-[2px]"
                    [style.height.%]="bar"
                    [style.background]="band.colour"
                    [style.opacity]="0.35 + (bar / 100) * 0.65"
                  ></span>
                }
              </span>
            </a>
          }
        </div>
      </div>
    </section>

    <!-- needs you: the one panel that asks for a decision -->
    @if (alerts().length > 0) {
      <section class="card mb-5 px-7 py-6" aria-labelledby="needs-you">
        <header class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="needs-you" class="m-0 text-[17px] font-semibold">Needs you</h2>
          <span class="text-[13px] text-ink-soft">
            {{ unplannedCount() }} of {{ alerts().length }} have nobody on them
          </span>
        </header>

        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          @for (alert of alerts(); track alert.id) {
            <article class="overflow-hidden rounded-[14px] border border-rule bg-elevated">
              <span
                class="block h-[3px] w-full"
                [style.background]="alert.colour"
                aria-hidden="true"
              ></span>

              <div class="flex items-start gap-3 px-4 pt-4">
                <lime-tech-icon [technology]="alert.technology" [size]="28" />
                <div class="min-w-0 flex-1">
                  <p
                    class="m-0 text-[13px] font-semibold"
                    [style.color]="alert.colour"
                  >
                    {{ alert.exposure }}
                  </p>
                  <p class="m-0 truncate text-[15px] font-semibold">
                    {{ alert.technology }} {{ alert.cycle }}
                  </p>
                </div>
              </div>

              <p class="m-0 px-4 pt-2 text-[12px] text-ink-soft">
                {{ alert.where }}
              </p>

              <div class="flex items-center justify-between gap-2 px-4 pt-3 pb-4">
                <span
                  class="text-[12px]"
                  [class.text-overdue]="!alert.plan"
                  [class.text-ink-soft]="alert.plan"
                >
                  {{ alert.plan ?? 'No plan' }}
                </span>
                <a
                  [routerLink]="['/plan']"
                  [queryParams]="{ technology: alert.technology, cycle: alert.cycle }"
                  class="rounded-full border border-accent px-3 py-1 text-[12px] text-accent-bright no-underline hover:bg-accent hover:text-white"
                >
                  {{ alert.plan ? 'Open plan' : 'Plan upgrade' }}
                </a>
              </div>
            </article>
          }
        </div>
      </section>
    }

    <!-- panels: equal columns, each header / body / footer -->
    <div class="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
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

      <!-- 3. are we gaining or losing ground -->
      <section class="card grid grid-rows-[auto_1fr_auto] px-6 py-5">
        <header class="mb-4 flex items-baseline justify-between gap-3">
          <h2 class="m-0 text-[15px] font-semibold">Upgrade velocity</h2>
          <span class="text-[12px] text-ink-soft">6 months</span>
        </header>

        <div class="flex flex-col justify-between" [style.min-height.px]="bodyH">
          <p class="m-0 text-[13px]">
            <span class="tabular text-[22px] font-semibold" [style.color]="velocityColour()">
              {{ net() > 0 ? '+' : '' }}{{ net() }}
            </span>
            <span class="text-ink-soft"> net</span>
          </p>
          <p class="m-0 mb-3 text-[12px] text-ink-soft">
            {{ totalUpgrades() }} upgrades done, {{ totalExpiries() }} cycles expired
          </p>

          <ol class="m-0 flex list-none items-end gap-2 p-0" [style.height.px]="96">
            @for (month of velocity(); track month.key) {
              <li
                class="flex h-full flex-1 flex-col justify-end gap-[2px]"
                [attr.title]="month.title"
              >
                <span
                  class="w-full rounded-t-[2px]"
                  [style.height.px]="month.upHeight"
                  style="background: var(--color-good)"
                ></span>
                <span
                  class="w-full rounded-b-[2px]"
                  [style.height.px]="month.expHeight"
                  style="background: var(--color-overdue)"
                ></span>
              </li>
            }
          </ol>
          <div class="mt-1 flex gap-2 text-[10px] text-ink-faint">
            @for (month of velocity(); track month.key) {
              <span class="flex-1 text-center">{{ month.label }}</span>
            }
          </div>
        </div>

        <footer class="mt-3 flex items-center gap-4 border-t border-rule pt-3 text-[11px] text-ink-soft">
          <span class="flex items-center gap-1.5">
            <span class="inline-block h-2 w-3 rounded-[2px]" style="background: var(--color-good)"></span>
            upgrades
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block h-2 w-3 rounded-[2px]" style="background: var(--color-overdue)"></span>
            expired
          </span>
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

  /**
   * The things asking for a decision, stated as consequences.
   *
   * "Unsupported for 7 years" lands where "−2588 d" does not: the number is
   * precise but says nothing about whether to care. The signed day count still
   * exists on the Schedule for people doing arithmetic.
   */
  protected readonly alerts = computed(() =>
    this.inbox()
      .slice(0, 8)
      .map((item) => {
        const customers = [...new Set(item.deployments.map((d) => d.customer))];
        const environments = item.deployments.length;
        const days = item.days ?? 0;

        return {
          id: item.cycle.id,
          technology: item.cycle.technology,
          cycle: item.cycle.cycle,
          exposure:
            days <= 0
              ? `Unsupported for ${humanGap(days)}`
              : `Support ends in ${humanGap(days)}`,
          where: `${customers.join(', ') || 'not deployed'} · ${environments} environment${environments === 1 ? '' : 's'}`,
          plan: item.action
            ? `${item.action.jiraKey ?? 'Planned'} · ${item.action.assignee ?? 'unassigned'}`
            : null,
          colour: statusFill(
            item.days === null ? 'UNKNOWN' : item.days <= 0 ? 'EOL' : 'NEAR',
          ),
        };
      }),
  );

  protected readonly unplannedCount = computed(
    () => this.alerts().filter((a) => !a.plan).length,
  );

  /**
   * Upgrades completed against cycles that expired, month by month.
   *
   * The honest measure of whether the team is gaining ground: doing three
   * upgrades in a quarter means nothing if five cycles went out of support in
   * the same period. Upgrades come from the revision history, so this counts
   * what was actually recorded, not what was planned.
   */
  protected readonly velocity = computed(() => {
    const start = today();
    const events = this.store.changeEvents().filter((e) => e.kind === 'UPGRADE');
    const expiries = this.store
      .cyclesInUse()
      .map((c) => parseDate(c.cycle.eolDate))
      .filter((d): d is Date => d !== null);

    const months = Array.from({ length: 6 }, (_, i) => {
      const from = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - (5 - i), 1);
      const to = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - (4 - i), 1);
      const date = new Date(from);

      return {
        key: `v${i}`,
        from,
        to,
        label: date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
        full: date.toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        upgrades: events.filter(
          (e) => e.at.getTime() >= from && e.at.getTime() < to,
        ).length,
        expired: expiries.filter((d) => d.getTime() >= from && d.getTime() < to).length,
      };
    });

    const max = Math.max(1, ...months.map((m) => Math.max(m.upgrades, m.expired)));

    return months.map((m) => ({
      key: m.key,
      label: m.label,
      upHeight: m.upgrades ? Math.max(4, (m.upgrades / max) * 44) : 2,
      expHeight: m.expired ? Math.max(4, (m.expired / max) * 44) : 2,
      title: `${m.full}: ${m.upgrades} upgrade(s) done, ${m.expired} cycle(s) expired`,
    }));
  });

  protected readonly totalUpgrades = computed(() =>
    this.velocitySource().reduce((sum, m) => sum + m.upgrades, 0),
  );

  protected readonly totalExpiries = computed(() =>
    this.velocitySource().reduce((sum, m) => sum + m.expired, 0),
  );

  protected readonly net = computed(() => this.totalUpgrades() - this.totalExpiries());

  protected readonly velocityColour = computed(() =>
    this.net() >= 0 ? 'var(--color-good)' : 'var(--color-overdue)',
  );

  /** Raw counts behind the bars, kept separate so totals stay readable. */
  private readonly velocitySource = computed(() => {
    const start = today();
    const events = this.store.changeEvents().filter((e) => e.kind === 'UPGRADE');
    const expiries = this.store
      .cyclesInUse()
      .map((c) => parseDate(c.cycle.eolDate))
      .filter((d): d is Date => d !== null);

    return Array.from({ length: 6 }, (_, i) => {
      const from = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - (5 - i), 1);
      const to = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - (4 - i), 1);
      return {
        upgrades: events.filter((e) => e.at.getTime() >= from && e.at.getTime() < to).length,
        expired: expiries.filter((d) => d.getTime() >= from && d.getTime() < to).length,
      };
    });
  });

  protected focus(projectId: string): void {
    this.store.scope.set(projectId);
    void this.router.navigate(['/schedule']);
  }
}
