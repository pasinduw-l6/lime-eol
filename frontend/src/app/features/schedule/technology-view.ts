import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { formatDate, parseDate, today } from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';
import {
  Phrase,
  phraseFor,
  toneBackground,
  toneColour,
} from '../../core/relative-time';

/** Shape returned by GET /api/v1/eol/products/:slug. */
interface ApiRelease {
  cycle: string;
  label: string;
  releaseDate: string | null;
  isLts: boolean;
  activeSupportEnd: string | null;
  eolDate: string | null;
  latestSupported: string | null;
  isMaintained: boolean;
  daysToEol: number | null;
}

interface ApiProduct {
  slug: string;
  label: string;
  category: string;
  htmlUrl: string | null;
  releasePolicyUrl: string | null;
  releases: ApiRelease[];
}

const CHART_W = 900;
const LANE_H = 26;
const LABEL_W = 54;

/**
 * Every release cycle of one technology, in the shape the team already reads
 * on endoflife.date — a support-phase chart over a date axis, then the release
 * table.
 *
 * What this adds over the public site: the rows we actually run are marked,
 * with how many environments are on them, so a support window turns into our
 * problem rather than a fact about the world.
 */
@Component({
  selector: 'lime-technology-view',
  host: { class: 'block' },
  template: `
    @if (product.isLoading()) {
      <p class="py-10 text-center text-[14px] text-ink-soft">
        Loading {{ slug() }} from endoflife.date…
      </p>
    } @else if (product.error()) {
      <p class="py-10 text-center text-[14px] text-overdue" role="alert">
        Could not reach the lifecycle API for “{{ slug() }}”.
      </p>
    } @else if (product.value(); as data) {
      <header class="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 class="m-0 text-[22px] font-semibold tracking-[-0.01em]">
            {{ data.label }}
          </h2>
          <p class="m-0 text-[13px] text-ink-soft">
            {{ data.releases.length }} published cycles · {{ inUseCount() }} running
            in your estate
          </p>
        </div>
        @if (data.releasePolicyUrl) {
          <a
            [href]="data.releasePolicyUrl"
            target="_blank"
            rel="noopener"
            class="text-[13px] text-accent-bright no-underline hover:underline"
            >Vendor release policy</a
          >
        }
      </header>

      <!-- support phases -->
      <div class="overflow-x-auto">
        <svg
          [attr.width]="chartW"
          [attr.height]="chartH()"
          role="img"
          [attr.aria-label]="'Support phases for ' + data.label"
        >
          @for (tick of ticks(); track tick.x) {
            <line
              [attr.x1]="tick.x" [attr.x2]="tick.x" y1="16"
              [attr.y2]="chartH() - 22"
              stroke="var(--color-rule)" stroke-width="1"
            />
            <text
              [attr.x]="tick.x" [attr.y]="chartH() - 6" font-size="10"
              text-anchor="middle" fill="var(--color-ink-faint)"
            >{{ tick.year }}</text>
          }

          @for (lane of lanes(); track lane.cycle) {
            <text
              x="0" [attr.y]="lane.y + 13" font-size="11"
              class="tabular" fill="var(--color-ink-soft)"
            >{{ lane.cycle }}</text>

            @if (lane.activeW > 0) {
              <rect
                [attr.x]="lane.x" [attr.y]="lane.y + 4" [attr.width]="lane.activeW"
                height="13" rx="2" fill="var(--color-accent-deep)"
              >
                <title>Active support</title>
              </rect>
            }
            @if (lane.securityW > 0) {
              <rect
                [attr.x]="lane.x + lane.activeW" [attr.y]="lane.y + 4"
                [attr.width]="lane.securityW" height="13" rx="2"
                fill="var(--color-accent)"
              >
                <title>Security support</title>
              </rect>
            }
            @if (lane.inUse) {
              <circle
                [attr.cx]="lane.x - 7" [attr.cy]="lane.y + 10" r="3"
                fill="var(--color-ink)"
              >
                <title>Running in your estate</title>
              </circle>
            }
          }

          <line
            [attr.x1]="todayX()" [attr.x2]="todayX()" y1="16"
            [attr.y2]="chartH() - 22" stroke="var(--color-overdue)"
            stroke-width="1" stroke-dasharray="4 3"
          />
        </svg>
      </div>

      <div class="mt-3 mb-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-ink-soft">
        <span class="flex items-center gap-1.5">
          <span class="inline-block h-2.5 w-4 rounded-[2px]" style="background: var(--color-accent-deep)"></span>
          Active support
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block h-2.5 w-4 rounded-[2px]" style="background: var(--color-accent)"></span>
          Security support
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-ink"></span>
          running in your estate
        </span>
      </div>

      <!-- release table -->
      <div class="overflow-x-auto rounded-xl border border-rule">
        <table class="w-full border-collapse text-[13px]">
          <caption class="sr-only">Release cycles of {{ data.label }}</caption>
          <thead>
            <tr class="border-b border-rule text-left text-[12px] text-ink-soft">
              <th class="px-4 py-2.5 font-medium">Release</th>
              <th class="px-4 py-2.5 font-medium">Released</th>
              <th class="px-4 py-2.5 font-medium">Active support</th>
              <th class="px-4 py-2.5 font-medium">Security support</th>
              <th class="px-4 py-2.5 font-medium">Latest</th>
              <th class="px-4 py-2.5 font-medium">Your estate</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visibleRows(); track row.release.cycle) {
              <tr class="border-b border-rule last:border-b-0">
                <td class="tabular px-4 py-2.5 font-medium">
                  <span [class.line-through]="row.retired" [class.text-ink-faint]="row.retired">
                    {{ row.release.cycle }}
                  </span>
                  @if (row.release.isLts) {
                    <span class="ml-1.5 rounded border border-rule px-1.5 py-0.5 text-[10px] text-ink-soft">LTS</span>
                  }
                </td>
                <td class="px-4 py-2.5 text-ink-soft">
                  <span class="block">{{ row.released.text }}</span>
                  <span class="tabular block text-[11px] text-ink-faint">
                    {{ date(row.release.releaseDate) }}
                  </span>
                </td>
                <td class="px-4 py-2.5" [style.background]="bg(row.active.tone)">
                  <span class="block" [style.color]="fg(row.active.tone)">{{ row.active.text }}</span>
                  <span class="tabular block text-[11px] text-ink-faint">
                    {{ date(row.release.activeSupportEnd) }}
                  </span>
                </td>
                <td class="px-4 py-2.5" [style.background]="bg(row.security.tone)">
                  <span class="block" [style.color]="fg(row.security.tone)">{{ row.security.text }}</span>
                  <span class="tabular block text-[11px] text-ink-faint">
                    {{ date(row.release.eolDate) }}
                  </span>
                </td>
                <td class="tabular px-4 py-2.5 text-ink-soft">
                  {{ row.release.latestSupported ?? '—' }}
                </td>
                <td class="px-4 py-2.5">
                  @if (row.environments > 0) {
                    <span class="tabular" [style.color]="fg(row.security.tone)">
                      {{ row.environments }} env
                    </span>
                  } @else {
                    <span class="text-ink-faint">—</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (hiddenCount() > 0) {
        <div class="mt-4 text-center">
          <button type="button" class="btn" (click)="showAll.set(!showAll())">
            {{ showAll() ? 'Hide unmaintained releases' : 'Show ' + hiddenCount() + ' unmaintained releases' }}
          </button>
        </div>
      }
    }
  `,
})
export class TechnologyView {
  private readonly store = inject(RegistryStore);

  readonly slug = input.required<string>();
  readonly technology = input.required<string>();

  protected readonly chartW = CHART_W;
  protected readonly showAll = signal(false);

  /** Live call to our own API, which proxies and caches endoflife.date. */
  protected readonly product = httpResource<ApiProduct>(
    () => `/api/v1/eol/products/${this.slug()}`,
  );

  private readonly releases = computed(() => this.product.value()?.releases ?? []);

  /** Versions of this technology actually deployed, by cycle. */
  private readonly estate = computed(() => {
    const counts = new Map<string, number>();
    const cycles = this.store
      .cycles()
      .filter((c) => c.technology === this.technology());

    for (const deployment of this.store.deployments()) {
      for (const component of deployment.components) {
        if (component.technology !== this.technology()) {
          continue;
        }
        const cycle = cycles.find((c) => c.versions.includes(component.version));
        if (cycle) {
          counts.set(cycle.cycle, (counts.get(cycle.cycle) ?? 0) + 1);
        }
      }
    }
    return counts;
  });

  protected readonly inUseCount = computed(() =>
    [...this.estate().values()].reduce((sum, n) => sum + n, 0),
  );

  protected readonly rows = computed(() =>
    this.releases().map((release) => {
      const security = phraseFor(release.eolDate);
      return {
        release,
        released: phraseFor(release.releaseDate, 'release'),
        active: phraseFor(release.activeSupportEnd),
        security,
        retired: security.tone === 'past',
        environments: this.estate().get(release.cycle) ?? 0,
      };
    }),
  );

  /** Unmaintained releases are folded away unless asked for, or in use. */
  protected readonly visibleRows = computed(() =>
    this.showAll()
      ? this.rows()
      : this.rows().filter((r) => !r.retired || r.environments > 0),
  );

  protected readonly hiddenCount = computed(
    () => this.rows().length - this.rows().filter((r) => !r.retired || r.environments > 0).length,
  );

  // ---- chart geometry ------------------------------------------------------

  private readonly bounds = computed(() => {
    const dates = this.releases()
      .flatMap((r) => [parseDate(r.releaseDate), parseDate(r.eolDate)])
      .filter((d): d is Date => d !== null)
      .map((d) => d.getTime());

    const now = today().getTime();
    const min = Math.min(...dates, now);
    const max = Math.max(...dates, now);
    return { min, max: max + (max - min) * 0.02 };
  });

  private x(ms: number): number {
    const { min, max } = this.bounds();
    const ratio = (ms - min) / Math.max(1, max - min);
    return LABEL_W + Math.max(0, Math.min(1, ratio)) * (CHART_W - LABEL_W - 10);
  }

  protected readonly lanes = computed(() =>
    this.releases().map((release, index) => {
      const start = parseDate(release.releaseDate)?.getTime() ?? this.bounds().min;
      const eol = parseDate(release.eolDate)?.getTime() ?? this.bounds().max;
      const activeEnd = parseDate(release.activeSupportEnd)?.getTime() ?? eol;

      const x = this.x(start);
      return {
        cycle: release.cycle,
        y: 20 + index * LANE_H,
        x,
        activeW: Math.max(0, this.x(Math.min(activeEnd, eol)) - x),
        securityW: Math.max(0, this.x(eol) - this.x(Math.min(activeEnd, eol))),
        inUse: (this.estate().get(release.cycle) ?? 0) > 0,
      };
    }),
  );

  protected readonly chartH = computed(() => 46 + this.releases().length * LANE_H);
  protected readonly todayX = computed(() => this.x(today().getTime()));

  protected readonly ticks = computed(() => {
    const { min, max } = this.bounds();
    const first = new Date(min).getUTCFullYear();
    const last = new Date(max).getUTCFullYear();
    const out: { x: number; year: number }[] = [];

    for (let year = first; year <= last; year++) {
      out.push({ x: this.x(Date.UTC(year, 0, 1)), year });
    }
    return out;
  });

  protected date = formatDate;
  protected bg = toneBackground;
  protected fg = toneColour;
  protected phrase: (v: string | null) => Phrase = (v) => phraseFor(v);
}
