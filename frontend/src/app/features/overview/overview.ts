import { Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { NOTICE_DAYS, parseDate, today } from '../../core/lifecycle';
import { Cycle, EnvironmentName, Project } from '../../core/models';
import { ReportDownload } from '../../core/report-download';
import { RegistryStore } from '../../core/registry.store';
import { humanGap } from '../../core/relative-time';
import { DownloadMenu } from '../../shared/download-menu';
import { TechIcon } from '../../shared/tech-icon';

const DAY = 86_400_000;
const LIME_SUPPORT_YEARS = 4;
const AXIS_BACK_MONTHS = 12;
const AXIS_FORWARD_MONTHS = 60;
const OUTLOOK_YEARS = 4;
const ENV_ORDER: EnvironmentName[] = ['DEV', 'UAT', 'PROD'];

type Phase = 'ended' | 'ending' | 'security' | 'full' | 'unknown';
type Shape = 'square' | 'triangle' | 'diamond' | 'circle' | 'ring';
type ReleaseState = 'awaiting' | 'dev-only' | 'behind' | 'prod-only' | 'released';

interface PhaseInfo {
  label: string;
  colour: string;
  shape: Shape;
  rank: number;
}

const PHASE: Record<Phase, PhaseInfo> = {
  ended: { label: 'End of support', colour: 'var(--destructive)', shape: 'square', rank: 0 },
  ending: { label: 'Ending soon', colour: 'var(--warning)', shape: 'triangle', rank: 1 },
  security: { label: 'Security updates only', colour: 'var(--info)', shape: 'diamond', rank: 2 },
  unknown: { label: 'No published date', colour: 'var(--muted-foreground)', shape: 'ring', rank: 3 },
  full: { label: 'Fully supported', colour: 'var(--success)', shape: 'circle', rank: 4 },
};

interface Placement {
  env: EnvironmentName;
  version: string;
}

interface DetailCard {
  key: string;
  technology: string;
  name: string;
  phase: Phase;
  placements: Placement[];
  released: Date | null;
  fullUntil: Date | null;
  endsOn: Date | null;
  days: number | null;
  latestPatch: string | null;
  lts: boolean;
  bar: { full: number; security: number; today: number | null; ended: boolean } | null;
}

interface LimeWindow {
  version: string;
  start: Date;
  end: Date;
  fraction: number;
  days: number;
  estimated: boolean;
}

interface LifelineRow {
  key: string;
  technology: string;
  label: string;
  colour: string;
  left: number;
  width: number;
  fullShare: number;
  note: string;
  ended: boolean;
  beyond: boolean;
  startsBefore: boolean;
  noDate: boolean;
  lime: boolean;
}

interface OutlookItem {
  key: string;
  label: string;
  date: Date;
  phase: Phase;
}

/** Compares dotted versions numerically: 1.10 is newer than 1.9. */
function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((n) => parseInt(n, 10));
  const pb = b.split(/[.-]/).map((n) => parseInt(n, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = Number.isNaN(pa[i]) ? 0 : (pa[i] ?? 0);
    const y = Number.isNaN(pb[i]) ? 0 : (pb[i] ?? 0);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function phaseOf(cycle: Cycle | null, days: number | null): Phase {
  if (!cycle || days === null) return 'unknown';
  if (days <= 0) return 'ended';
  if (days <= NOTICE_DAYS) return 'ending';
  const active = parseDate(cycle.activeSupportEnd);
  if (active && active.getTime() <= today().getTime()) return 'security';
  return 'full';
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

@Component({
  selector: 'lime-overview',
  imports: [NgTemplateOutlet, HlmBadgeImports, HlmButton, HlmCardImports, HlmEmptyImports, RouterLink, TechIcon, DownloadMenu],
  host: { class: 'block' },
  template: `
    <ng-template #shape let-shape="shape" let-colour="colour" let-size="size">
      <svg [attr.width]="size ?? 12" [attr.height]="size ?? 12" viewBox="0 0 12 12" class="shrink-0" aria-hidden="true" [style.color]="colour">
        @switch (shape) {
          @case ('square') { <rect x="1" y="1" width="10" height="10" rx="1.5" fill="currentColor" /> }
          @case ('triangle') { <path d="M6 .8 11.6 11H.4z" fill="currentColor" /> }
          @case ('diamond') { <path d="M6 .5 11.5 6 6 11.5.5 6z" fill="currentColor" /> }
          @case ('ring') { <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="2" /> }
          @default { <circle cx="6" cy="6" r="5" fill="currentColor" /> }
        }
      </svg>
    </ng-template>

    @if (project(); as p) {
      <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <p class="m-0 text-xs font-medium tracking-widest text-muted-foreground uppercase">Technology lifecycle</p>
          <h1 class="m-0 mt-2 text-3xl font-semibold tracking-tight">{{ p.customer }}</h1>
          <p class="m-0 mt-1 text-base text-muted-foreground">{{ p.name }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="mr-1 text-sm text-muted-foreground">As of {{ longDate(asOf) }}</span>
          @if (!projectId()) {
            <lime-download-menu class="no-print" label="Project report" size="sm" [busy]="downloads.busy() === p.id" (pick)="downloads.project(p.id, $event)" />
          }
        </div>
      </header>

      <section hlmCard class="mb-5 gap-0 py-0" aria-label="Facts">
        <dl class="m-0 grid divide-y sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6 lg:divide-x">
          @for (f of facts(); track f.label) {
            <div class="px-5 py-4">
              <dt class="flex items-center gap-1.5 text-xs text-muted-foreground">
                @if (f.phase) {
                  <ng-container *ngTemplateOutlet="shape; context: { shape: phaseInfo(f.phase).shape, colour: phaseInfo(f.phase).colour, size: 9 }" />
                }
                {{ f.label }}
              </dt>
              <dd class="tabular m-0 mt-1 text-2xl font-semibold tracking-tight">{{ f.value }}</dd>
              @if (f.sub) {
                <dd class="m-0 mt-0.5 truncate text-xs text-muted-foreground">{{ f.sub }}</dd>
              }
            </div>
          }
        </dl>
      </section>

      @if (lime(); as l) {
        <section hlmCard class="mb-5" aria-labelledby="platform">
          <div hlmCardContent class="grid items-center gap-6 md:grid-cols-[auto_1fr]">
            <div class="flex items-center gap-3">
              <lime-tech-icon technology="Lime" [size]="36" />
              <div>
                <h2 id="platform" class="m-0 text-base font-semibold">Lime {{ l.version }} platform</h2>
                <p class="m-0 text-xs text-muted-foreground">
                  {{ supportYears }}-year support window{{ l.estimated ? ', estimated from project start' : '' }}
                </p>
              </div>
            </div>
            <div>
              <div class="relative h-3 overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full" [style.width.%]="l.fraction * 100" [style.background]="limeColour()"></div>
              </div>
              <div class="tabular mt-2 flex flex-wrap justify-between gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>Released <b class="font-medium text-foreground">{{ longDate(l.start) }}</b></span>
                <span>
                  @if (l.days > 0) {
                    <b class="font-medium text-foreground">{{ gap(l.days) }}</b> left · {{ (l.fraction * 100).toFixed(0) }}% of the window used
                  } @else {
                    <b class="font-medium text-destructive">Ended {{ gap(l.days) }} ago</b>
                  }
                </span>
                <span>Supported until <b class="font-medium" [style.color]="l.days <= 0 ? 'var(--destructive)' : 'var(--foreground)'">{{ longDate(l.end) }}</b></span>
              </div>
            </div>
          </div>
        </section>
      }

      @if (releases(); as rel) {
        <section hlmCard class="mb-5 gap-0 py-0" aria-labelledby="releases">
          <header class="flex flex-wrap items-baseline justify-between gap-2 border-b px-6 py-4">
            <div>
              <h2 id="releases" class="m-0 text-base font-semibold">Development and production</h2>
              <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">What is upgraded in DEV and what has reached PROD.</p>
            </div>
            <span class="text-[13px]" [style.color]="awaiting() ? releaseInfo.awaiting.colour : 'var(--success)'">
              {{ awaiting() ? awaiting() + ' upgrade' + (awaiting() === 1 ? '' : 's') + ' awaiting release' : 'PROD matches DEV' }}
            </span>
          </header>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="text-left text-xs text-muted-foreground">
                  <th class="px-6 py-2 font-normal">Technology</th>
                  <th class="px-3 py-2 font-normal">Development · DEV</th>
                  <th class="px-3 py-2 font-normal">Production · PROD</th>
                  <th class="px-6 py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rel; track r.technology) {
                  <tr class="border-t">
                    <td class="px-6 py-2.5">
                      <span class="flex items-center gap-2"><lime-tech-icon [technology]="r.technology" [size]="18" />{{ r.technology }}</span>
                    </td>
                    @for (s of [r.dev, r.prod]; track $index) {
                      <td class="px-3 py-2.5">
                        @if (s) {
                          <span class="tabular font-medium">{{ s.version }}</span>
                          <span class="block text-[12px]" [style.color]="phaseInfo(s.phase).colour">
                            {{ s.endsOn ? (s.phase === 'ended' ? 'ended ' : 'supported to ') + shortDate(s.endsOn) : phaseInfo(s.phase).label }}
                          </span>
                        } @else {
                          <span class="text-muted-foreground">—</span>
                        }
                      </td>
                    }
                    <td class="px-6 py-2.5">
                      <span class="inline-flex items-center gap-1.5 text-[13px] font-medium" [style.color]="releaseInfo[r.state].colour">
                        <span class="size-2 rounded-full" [style.background]="releaseInfo[r.state].colour"></span>
                        {{ releaseInfo[r.state].label }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      <section class="mb-5" aria-labelledby="stack">
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="stack" class="m-0 text-lg font-semibold">Technology stack</h2>
          <p class="m-0 text-sm text-muted-foreground">{{ cards().length }} technologies, ordered by end of support</p>
        </div>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (c of cards(); track c.key) {
            <article hlmCard class="gap-4 py-5">
              <div class="flex items-start justify-between gap-3 px-5">
                <div class="flex min-w-0 items-center gap-3">
                  <lime-tech-icon [technology]="c.technology" [size]="30" />
                  <div class="min-w-0">
                    <h3 class="m-0 truncate text-sm font-semibold">{{ c.name }}</h3>
                    <p class="m-0 mt-0.5 flex items-center gap-1.5 text-xs" [style.color]="phaseInfo(c.phase).colour">
                      <ng-container *ngTemplateOutlet="shape; context: { shape: phaseInfo(c.phase).shape, colour: phaseInfo(c.phase).colour, size: 9 }" />
                      {{ phaseInfo(c.phase).label }}
                    </p>
                  </div>
                </div>
                <span class="flex shrink-0 items-center gap-1.5">
                  @if (c.lts) {
                    <span hlmBadge variant="outline">LTS</span>
                  }
                </span>
              </div>

              <div class="px-5">
                @if (c.bar; as bar) {
                  <div class="relative h-2 rounded-full bg-muted">
                    <div class="absolute inset-y-0 left-0 flex overflow-hidden rounded-full" [style.width.%]="bar.full + bar.security">
                      <span class="h-full" [style.width.%]="bar.full + bar.security ? (bar.full / (bar.full + bar.security)) * 100 : 0" [style.background]="bar.ended ? 'var(--destructive)' : phaseInfo(c.phase === 'security' ? 'full' : c.phase).colour"></span>
                      <span class="h-full flex-1" [style.background]="'repeating-linear-gradient(135deg, ' + (bar.ended ? 'var(--destructive)' : phaseInfo(c.phase === 'security' ? 'full' : c.phase).colour) + ' 0 3px, transparent 3px 6px)'"></span>
                    </div>
                    @if (bar.today !== null) {
                      <span class="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded bg-foreground" [style.left.%]="bar.today" title="Today"></span>
                    }
                  </div>
                  <div class="tabular mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>{{ shortDate(c.released) }}</span>
                    <span>{{ shortDate(c.endsOn) }}</span>
                  </div>
                } @else {
                  <div class="h-2 rounded-full border border-dashed"></div>
                  <p class="m-0 mt-1.5 text-[11px] text-muted-foreground">No published end date</p>
                }
              </div>

              <dl class="m-0 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t px-5 pt-4 text-sm">
                <div>
                  <dt class="text-xs text-muted-foreground">Released</dt>
                  <dd class="tabular m-0">{{ longDate(c.released) }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">{{ c.days !== null && c.days <= 0 ? 'Out of support for' : 'Time left' }}</dt>
                  <dd class="tabular m-0 font-medium" [style.color]="c.phase === 'ended' || c.phase === 'ending' ? phaseInfo(c.phase).colour : ''">
                    {{ c.days === null ? '—' : gap(c.days) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">Full support until</dt>
                  <dd class="tabular m-0">{{ longDate(c.fullUntil) }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">End of support</dt>
                  <dd class="tabular m-0">{{ longDate(c.endsOn) }}</dd>
                </div>
                @if (c.latestPatch) {
                  <div class="col-span-2">
                    <dt class="text-xs text-muted-foreground">Latest vendor patch</dt>
                    <dd class="tabular m-0">{{ c.latestPatch }}</dd>
                  </div>
                }
              </dl>

              <div class="flex flex-wrap gap-1.5 border-t px-5 pt-4">
                @for (pl of c.placements; track pl.env) {
                  <span class="inline-flex items-center overflow-hidden rounded-md border text-xs">
                    <span class="bg-muted px-1.5 py-0.5 font-medium">{{ pl.env }}</span>
                    <span class="tabular px-1.5 py-0.5">{{ pl.version }}</span>
                  </span>
                }
              </div>
            </article>
          } @empty {
            <p class="m-0 text-sm text-muted-foreground">No technologies are recorded for this project yet.</p>
          }
        </div>
      </section>

      <section hlmCard class="mb-5" aria-labelledby="lifeline">
        <div hlmCardHeader>
          <h2 hlmCardTitle id="lifeline">Support timeline</h2>
          <p hlmCardDescription>All technologies on one five-year scale.</p>
        </div>
        <div hlmCardContent class="overflow-x-auto">
          <div class="min-w-[720px]">
            <div class="grid grid-cols-[13rem_1fr] items-end">
              <span></span>
              <div class="relative h-7 text-xs text-muted-foreground">
                @for (t of ticks(); track t.label) {
                  <span class="tabular absolute bottom-1 -translate-x-1/2" [style.left.%]="t.at">{{ t.label }}</span>
                }
                <span class="absolute bottom-1 -translate-x-1/2 rounded-sm bg-foreground px-1.5 text-[10px] font-medium text-background" [style.left.%]="todayAt()">Today</span>
              </div>
            </div>

            <div class="relative">
              <div class="pointer-events-none absolute inset-y-0 right-0 left-[13rem]" aria-hidden="true">
                @for (t of ticks(); track t.label) {
                  <span class="absolute inset-y-0 w-px bg-border" [style.left.%]="t.at"></span>
                }
                <span class="absolute inset-y-0 w-px bg-foreground/70" [style.left.%]="todayAt()"></span>
              </div>

              @for (row of lifeline(); track row.key) {
                <div class="grid h-10 grid-cols-[13rem_1fr] items-center" [class.border-b]="row.lime">
                  <span class="flex min-w-0 items-center gap-2.5 pr-3 text-sm">
                    <lime-tech-icon [technology]="row.technology" [size]="20" />
                    <span class="truncate" [class.font-semibold]="row.lime">{{ row.label }}</span>
                  </span>
                  <div class="relative h-full">
                    @if (row.noDate) {
                      <span class="absolute inset-y-[13px] right-0 rounded-full border border-dashed" [style.left.%]="todayAt()"></span>
                      <span class="absolute top-1/2 -translate-y-1/2 pl-3 text-xs text-muted-foreground" [style.left.%]="todayAt()">No published end date</span>
                    } @else {
                      <span
                        class="absolute inset-y-[13px] flex overflow-hidden rounded-full"
                        [class.rounded-l-none]="row.startsBefore"
                        [class.rounded-r-none]="row.beyond"
                        [style.left.%]="row.left"
                        [style.width.%]="row.width"
                      >
                        <span class="h-full" [style.width.%]="row.fullShare" [style.background]="row.colour"></span>
                        <span class="h-full flex-1" [style.background]="'repeating-linear-gradient(135deg, ' + row.colour + ' 0 3px, transparent 3px 7px)'"></span>
                      </span>
                      <span
                        class="absolute top-1/2 text-xs whitespace-nowrap"
                        [class.text-destructive]="row.ended"
                        [class.text-muted-foreground]="!row.ended"
                        [style.left.%]="row.left + row.width"
                        [style.transform]="row.left + row.width > 78 ? 'translate(calc(-100% - 8px), -50%)' : 'translate(8px, -50%)'"
                        [style.color]="row.left + row.width > 78 ? '#fff' : ''"
                      >{{ row.note }}</span>
                    }
                  </div>
                </div>
              } @empty {
                <p class="px-1 py-8 text-center text-sm text-muted-foreground">No technologies recorded yet.</p>
              }
            </div>

            <p class="m-0 mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span class="flex items-center gap-1.5"><span class="h-2 w-4 rounded-full bg-success"></span>Fully supported</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-4 rounded-full" style="background: repeating-linear-gradient(135deg, var(--foreground) 0 3px, transparent 3px 7px)"></span>Security updates only</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-4 rounded-full bg-warning"></span>Ends within {{ noticeDays }} days</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-4 rounded-full bg-destructive"></span>Past end of support</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-4 rounded-full bg-primary"></span>Lime platform</span>
            </p>
          </div>
        </div>
      </section>

      <section hlmCard class="mb-5" aria-labelledby="outlook">
        <div hlmCardHeader>
          <h2 hlmCardTitle id="outlook">End of support by year</h2>
        </div>
        <div hlmCardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          @for (col of outlook(); track col.key) {
            <div class="rounded-lg border p-3">
              <p class="m-0 flex items-baseline justify-between">
                <span class="text-sm font-semibold">{{ col.title }}</span>
                <span class="tabular text-xs text-muted-foreground">{{ col.items.length }}</span>
              </p>
              <ul class="m-0 mt-2.5 grid list-none gap-1.5 p-0">
                @for (item of col.items; track item.key) {
                  <li class="flex items-center gap-2 text-xs">
                    <ng-container *ngTemplateOutlet="shape; context: { shape: phaseInfo(item.phase).shape, colour: phaseInfo(item.phase).colour, size: 9 }" />
                    <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                    <span class="tabular shrink-0 text-muted-foreground">{{ shortDate(item.date) }}</span>
                  </li>
                } @empty {
                  <li class="text-xs text-muted-foreground">None</li>
                }
              </ul>
            </div>
          }
        </div>
      </section>

      <footer class="grid gap-5 border-t pt-6 text-xs text-muted-foreground lg:grid-cols-[2fr_1fr]">
        <dl class="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          @for (g of glossary; track g.phase) {
            <div>
              <dt class="flex items-center gap-1.5 font-medium text-foreground">
                <ng-container *ngTemplateOutlet="shape; context: { shape: phaseInfo(g.phase).shape, colour: phaseInfo(g.phase).colour, size: 9 }" />
                {{ phaseInfo(g.phase).label }}
              </dt>
              <dd class="m-0 mt-0.5">{{ g.meaning }}</dd>
            </div>
          }
        </dl>
        <div class="grid content-start gap-2">
          <p class="m-0">Vendor dates from endoflife.date and vendor announcements. Dates can change when vendors revise their policies.</p>
          <p class="m-0">Prepared by Lime · {{ longDate(asOf) }}</p>
        </div>
      </footer>
    } @else {
      <div hlmEmpty class="border">
        <div hlmEmptyHeader>
          <h1 hlmEmptyTitle>No project to show yet</h1>
          <p hlmEmptyDescription>Add a project and its technology lifecycle appears here.</p>
        </div>
        <div hlmEmptyContent>
          <a routerLink="/projects" hlmBtn>Go to projects</a>
        </div>
      </div>
    }
  `,
})
export class Overview {
  private readonly store = inject(RegistryStore);

  protected readonly noticeDays = NOTICE_DAYS;
  protected readonly supportYears = LIME_SUPPORT_YEARS;
  protected readonly asOf = today();

  protected readonly glossary: { phase: Phase; meaning: string }[] = [
    { phase: 'full', meaning: 'The vendor fixes bugs and security issues.' },
    { phase: 'security', meaning: 'The vendor fixes security issues only.' },
    { phase: 'ending', meaning: `Support ends within ${NOTICE_DAYS} days.` },
    { phase: 'ended', meaning: 'The vendor no longer releases any fixes, including security fixes.' },
  ];

  protected readonly downloads = inject(ReportDownload);

  readonly projectId = input<string | null>(null);

  protected readonly project = computed<Project | null>(() => {
    const id = this.projectId();
    return id ? (this.store.projects().find((p) => p.id === id) ?? null) : this.store.activeProject();
  });

  private readonly deployments = computed(() => {
    const project = this.project();
    return project ? this.store.deploymentsOf(project.id) : [];
  });

  /** DEV against PROD per technology: what has been upgraded internally and is not released yet. */
  protected readonly releases = computed(() => {
    const dev = this.deployments().find((d) => d.environment === 'DEV');
    const prod = this.deployments().find((d) => d.environment === 'PROD');
    if (!dev || !prod) return null;

    const side = (version: string | undefined, technology: string) => {
      if (!version) return null;
      const resolved = this.store.resolve(technology, version);
      return { version, phase: phaseOf(resolved.cycle, resolved.days), endsOn: parseDate(resolved.cycle?.eolDate ?? null) };
    };

    const names = [...new Set([...dev.components, ...prod.components].map((c) => c.technology))].filter((t) => t !== 'Lime');
    const rows = names.map((technology) => {
      const d = side(dev.components.find((c) => c.technology === technology)?.version, technology);
      const p = side(prod.components.find((c) => c.technology === technology)?.version, technology);
      const order = d && p ? compareVersions(d.version, p.version) : 0;
      const state: ReleaseState = !p ? 'dev-only' : !d ? 'prod-only' : order > 0 ? 'awaiting' : order < 0 ? 'behind' : 'released';
      return { technology, dev: d, prod: p, state };
    });
    const rank: Record<ReleaseState, number> = { awaiting: 0, 'dev-only': 1, behind: 2, 'prod-only': 3, released: 4 };
    return rows.sort((a, b) => rank[a.state] - rank[b.state] || a.technology.localeCompare(b.technology));
  });

  protected readonly awaiting = computed(() => (this.releases() ?? []).filter((r) => r.state === 'awaiting' || r.state === 'dev-only').length);

  protected readonly releaseInfo: Record<ReleaseState, { label: string; colour: string }> = {
    awaiting: { label: 'Awaiting release', colour: 'var(--chart-2, #2563eb)' },
    'dev-only': { label: 'New in DEV, not released', colour: 'var(--chart-2, #2563eb)' },
    behind: { label: 'DEV is behind PROD', colour: 'var(--warning)' },
    'prod-only': { label: 'Only in PROD', colour: 'var(--muted-foreground)' },
    released: { label: 'Released', colour: 'var(--success)' },
  };

  protected readonly envList = computed<EnvironmentName[]>(() => {
    const present = new Set(this.deployments().map((d) => d.environment));
    return ENV_ORDER.filter((e) => present.has(e));
  });

  protected readonly cards = computed<DetailCard[]>(() => {
    const now = today().getTime();
    const byCycle = new Map<string, DetailCard & { cycle: Cycle | null }>();

    for (const deployment of this.deployments()) {
      for (const component of deployment.components) {
        if (component.technology === 'Lime') continue;
        const resolved = this.store.resolve(component.technology, component.version);
        const key = resolved.cycle?.id ?? `${component.technology}@${component.version}`;
        const existing = byCycle.get(key);

        if (existing) {
          existing.placements.push({ env: deployment.environment, version: component.version });
          continue;
        }

        const cycle = resolved.cycle;
        byCycle.set(key, {
          key,
          cycle,
          technology: component.technology,
          name: cycle ? `${component.technology} ${cycle.cycle}` : `${component.technology} ${component.version}`,
          phase: phaseOf(cycle, resolved.days),
          placements: [{ env: deployment.environment, version: component.version }],
          released: parseDate(cycle?.releaseDate ?? null),
          fullUntil: parseDate(cycle?.activeSupportEnd ?? null),
          endsOn: parseDate(cycle?.eolDate ?? null),
          days: resolved.days,
          latestPatch: cycle?.latestPatch ?? null,
          lts: cycle?.isLts ?? false,
          bar: null,
        });
      }
    }

    return [...byCycle.values()]
      .map(({ cycle, ...card }) => {
        card.placements.sort((a, b) => ENV_ORDER.indexOf(a.env) - ENV_ORDER.indexOf(b.env));

        if (card.endsOn) {
          const end = card.endsOn.getTime();
          const start = (card.released ?? addMonths(card.endsOn, -36)).getTime();
          const span = Math.max(1, end - start);
          const full = card.fullUntil
            ? Math.min(100, Math.max(0, ((card.fullUntil.getTime() - start) / span) * 100))
            : 100;
          const todayPct = ((now - start) / span) * 100;
          card.bar = {
            full,
            security: 100 - full,
            today: todayPct >= 0 && todayPct <= 100 ? todayPct : null,
            ended: now >= end,
          };
        }
        return card;
      })
      .sort(
        (a, b) =>
          (a.endsOn?.getTime() ?? Infinity) - (b.endsOn?.getTime() ?? Infinity) ||
          a.name.localeCompare(b.name),
      );
  });

  protected readonly lime = computed<LimeWindow | null>(() => {
    const project = this.project();
    if (!project) return null;

    const cycle = this.store
      .cycles()
      .find((c) => c.technology === 'Lime' && c.cycle === project.limeVersion);
    let start = parseDate(cycle?.releaseDate ?? null);
    let end = parseDate(cycle?.eolDate ?? null);
    let estimated = false;

    if (!end) {
      const began = parseDate(project.startedAt ? project.startedAt.slice(0, 10) : null);
      if (!began) return null;
      start = began;
      end = addMonths(began, LIME_SUPPORT_YEARS * 12);
      estimated = true;
    } else if (!start) {
      start = addMonths(end, -LIME_SUPPORT_YEARS * 12);
    }

    const from = start as Date;
    const now = today().getTime();
    const total = Math.max(1, end.getTime() - from.getTime());

    return {
      version: project.limeVersion,
      start: from,
      end,
      fraction: Math.min(1, Math.max(0, (now - from.getTime()) / total)),
      days: Math.round((end.getTime() - now) / DAY),
      estimated,
    };
  });

  protected readonly limeColour = computed(() => {
    const l = this.lime();
    if (!l) return 'var(--muted)';
    if (l.days <= 0) return 'var(--destructive)';
    return l.days <= 365 ? 'var(--warning)' : 'var(--primary)';
  });

  private readonly nextEnd = computed(() => {
    const now = today().getTime();
    return (
      this.cards()
        .filter((c) => c.endsOn && c.endsOn.getTime() > now)
        .map((c) => ({ label: c.name, date: c.endsOn as Date }))
        .concat(this.lime() && (this.lime()?.days ?? 0) > 0 ? [{ label: `Lime ${this.lime()?.version}`, date: this.lime()!.end }] : [])
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null
    );
  });

  protected readonly facts = computed(() => {
    const cards = this.cards();
    const n = (phase: Phase) => cards.filter((c) => c.phase === phase).length;
    const next = this.nextEnd();
    const lime = this.lime();

    return [
      { label: 'Technologies', value: String(cards.length), sub: this.envList().join(' · ') || 'No environments', phase: null as Phase | null },
      { label: 'End of support', value: String(n('ended')), sub: '', phase: 'ended' as Phase },
      { label: 'Ending soon', value: String(n('ending')), sub: `within ${NOTICE_DAYS} days`, phase: 'ending' as Phase },
      { label: 'Security updates only', value: String(n('security')), sub: '', phase: 'security' as Phase },
      { label: 'Fully supported', value: String(n('full')), sub: n('unknown') ? `${n('unknown')} with no published date` : '', phase: 'full' as Phase },
      {
        label: 'Next end of support',
        value: next ? this.shortDate(next.date) : '—',
        sub: next ? next.label : lime ? '' : 'None ahead',
        phase: null as Phase | null,
      },
    ];
  });

  private readonly axis = computed(() => {
    const now = today();
    const from = addMonths(now, -AXIS_BACK_MONTHS);
    const to = addMonths(now, AXIS_FORWARD_MONTHS);
    return { now, from: from.getTime(), to: to.getTime(), span: to.getTime() - from.getTime() };
  });

  private pct(date: Date): number {
    const a = this.axis();
    return ((date.getTime() - a.from) / a.span) * 100;
  }

  protected readonly todayAt = computed(() => this.pct(this.axis().now));

  protected readonly ticks = computed(() => {
    const a = this.axis();
    const out: { label: string; at: number }[] = [];
    for (let year = new Date(a.from).getUTCFullYear() + 1; year <= new Date(a.to).getUTCFullYear(); year++) {
      out.push({ label: String(year), at: this.pct(new Date(Date.UTC(year, 0, 1))) });
    }
    return out;
  });

  protected readonly lifeline = computed<LifelineRow[]>(() => {
    const rows: LifelineRow[] = [];
    const a = this.axis();
    const nowAt = this.pct(a.now);
    const clamp = (v: number) => Math.min(100, Math.max(0, v));

    const lime = this.lime();
    if (lime) {
      const left = clamp(this.pct(lime.start));
      rows.push({
        key: 'lime',
        technology: 'Lime',
        label: `Lime ${lime.version} platform`,
        colour: lime.days <= 0 ? 'var(--destructive)' : 'var(--primary)',
        left,
        width: Math.max(1, clamp(this.pct(lime.end)) - left),
        fullShare: 100,
        note: lime.days > 0 ? `until ${this.longDate(lime.end)}` : `ended ${this.longDate(lime.end)}`,
        ended: lime.days <= 0,
        beyond: this.pct(lime.end) > 100,
        startsBefore: this.pct(lime.start) < 0,
        noDate: false,
        lime: true,
      });
    }

    for (const card of this.cards()) {
      const base = {
        key: card.key,
        technology: card.technology,
        label: card.name,
        colour: card.phase === 'security' || card.phase === 'full' ? PHASE.full.colour : PHASE[card.phase].colour,
        lime: false,
      };

      if (!card.endsOn) {
        rows.push({ ...base, left: nowAt, width: 0, fullShare: 100, note: '', ended: false, beyond: false, startsBefore: false, noDate: true });
        continue;
      }

      const eolAt = this.pct(card.endsOn);
      if ((card.days ?? 0) <= 0) {
        rows.push({
          ...base,
          left: 0,
          width: Math.max(1.5, clamp(eolAt)),
          fullShare: 100,
          note: `ended ${this.longDate(card.endsOn)}`,
          ended: true,
          beyond: false,
          startsBefore: eolAt < 0,
          noDate: false,
        });
        continue;
      }

      const span = card.endsOn.getTime() - a.now.getTime();
      rows.push({
        ...base,
        left: nowAt,
        width: Math.max(1.5, clamp(eolAt) - nowAt),
        fullShare: card.fullUntil && span > 0 ? clamp(((card.fullUntil.getTime() - a.now.getTime()) / span) * 100) : 100,
        note: `until ${this.longDate(card.endsOn)}`,
        ended: false,
        beyond: eolAt > 100,
        startsBefore: false,
        noDate: false,
      });
    }

    return rows;
  });

  protected readonly outlook = computed(() => {
    const now = today();
    const year = now.getUTCFullYear();
    const columns = [
      { key: 'past', title: 'Already ended', items: [] as OutlookItem[] },
      ...Array.from({ length: OUTLOOK_YEARS - 1 }, (_, i) => ({
        key: String(year + i),
        title: i === 0 ? `Rest of ${year}` : String(year + i),
        items: [] as OutlookItem[],
      })),
      { key: 'later', title: `${year + OUTLOOK_YEARS - 1} and later`, items: [] as OutlookItem[] },
    ];

    const add = (item: OutlookItem) => {
      if (item.date.getTime() <= now.getTime()) {
        columns[0].items.push(item);
        return;
      }
      columns[Math.min(item.date.getUTCFullYear() - year + 1, columns.length - 1)].items.push(item);
    };

    for (const card of this.cards()) {
      if (card.endsOn) add({ key: card.key, label: card.name, date: card.endsOn, phase: card.phase });
    }

    const lime = this.lime();
    if (lime) {
      add({
        key: 'lime',
        label: `Lime ${lime.version}`,
        date: lime.end,
        phase: lime.days <= 0 ? 'ended' : lime.days <= NOTICE_DAYS ? 'ending' : 'full',
      });
    }

    for (const col of columns) col.items.sort((a, b) => a.date.getTime() - b.date.getTime());
    return columns;
  });

  protected phaseInfo(phase: Phase): PhaseInfo {
    return PHASE[phase];
  }

  protected gap(days: number): string {
    return humanGap(days);
  }

  protected print(): void {
    window.print();
  }

  protected longDate(value: Date | null): string {
    return value
      ? value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      : '—';
  }

  protected shortDate(value: Date | null): string {
    return value ? value.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
  }
}
