import { Component, computed, input, output } from '@angular/core';
import { ApiActionEnvironment, ApiUpgradeAction } from '../core/api';
import {
  formatDate,
  formatDays,
  statusFill,
  SupportStatus,
} from '../core/lifecycle';
import { JiraPanel } from './jira-panel';
import { TechIcon } from './tech-icon';

/**
 * One planned upgrade.
 *
 * Built to four rules, in this order:
 *
 * 1. The deadline is the headline. This registry exists because support runs
 *    out; on the previous card that fact was a grey fragment wedged between
 *    the Jira key and the assignee, and for in-house products with no
 *    published date it did not appear at all.
 * 2. Typography carries the hierarchy, not boxes. The old card wrapped
 *    everything in bordered pills, which gave a status, a day count and three
 *    environments the same visual weight as each other.
 * 3. Colour means status and nothing else. A rail, a day count and three
 *    evidence dots are the only coloured things here, so they actually read.
 * 4. A field earns its place only if it changes a decision.
 *
 * The three bands follow status, then movement, then owners and links — the
 * order someone reads them in when deciding whether this needs attention.
 */
@Component({
  selector: 'lime-plan-card',
  imports: [TechIcon, JiraPanel],
  host: { class: 'block' },
  template: `
    <article class="card relative overflow-hidden pl-6 pr-6 py-5">
      <!-- Urgency, before a single word is read. -->
      <span
        class="absolute inset-y-0 left-0 w-[5px]"
        [style.background]="urgencyColour()"
        aria-hidden="true"
      ></span>

      <!-- ── what, whose, and by when ─────────────────────────────── -->
      <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div class="flex min-w-0 items-start gap-3">
          <lime-tech-icon [technology]="action().technology" [size]="30" />
          <div class="min-w-0">
            <h2 class="m-0 text-[17px] font-semibold leading-tight">
              {{ action().technology }} {{ action().cycle }}
              <span class="text-ink-soft">
                → {{ action().targetVersion || 'no target' }}
              </span>
            </h2>
            <p class="m-0 mt-0.5 truncate text-[12.5px] text-ink-soft">
              {{ customers() }}
            </p>
          </div>
        </div>

        <!-- The deadline, sized like it matters. -->
        <div class="shrink-0 text-right">
          <p
            class="tabular m-0 text-[19px] font-semibold leading-none"
            [style.color]="urgencyColour()"
          >
            {{ deadline() }}
          </p>
          <p class="m-0 mt-1 text-[11.5px] text-ink-soft">
            {{ deadlineNote() }}
          </p>
        </div>
      </div>

      @if (action().planTooLate) {
        <p class="m-0 mt-2.5 text-[12px]" style="color: var(--color-soon)">
          The plan finishes after support ends — these environments would run
          unsupported in between.
        </p>
      }

      <!-- ── what actually happened ───────────────────────────────── -->
      <div class="mt-4 border-t border-rule pt-3.5">
        <div class="mb-2 flex items-baseline justify-between gap-3">
          <h3 class="m-0 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
            Recorded on the estate
          </h3>
          @if (action().unverifiedCompletion) {
            <span class="text-[11.5px]" style="color: var(--color-overdue)">
              marked done with nothing recorded behind it
            </span>
          }
        </div>

        <div class="flex flex-wrap gap-2">
          @for (env of action().environments; track env.deploymentId) {
            <div
              class="min-w-[104px] rounded-xl border px-3 py-2"
              [style.border-color]="envColour(env)"
            >
              <p class="tabular m-0 flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                <span
                  class="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
                  [style.background]="envColour(env)"
                  aria-hidden="true"
                ></span>
                {{ env.environment }}
              </p>

              @if (env.completedAt) {
                <p class="m-0 mt-1 text-[11.5px]" [style.color]="envColour(env)">
                  {{ env.verified ? 'version change recorded' : 'no change recorded' }}
                </p>
              } @else {
                <button
                  type="button"
                  class="mt-1 text-[11.5px] text-accent-bright hover:underline"
                  (click)="complete.emit(env.deploymentId)"
                >
                  mark done
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- ── the work, in Jira ────────────────────────────────────── -->
      <lime-jira-panel [actionId]="action().id" />

      <!-- ── who owns it, and what you can do ─────────────────────── -->
      <div
        class="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule pt-3"
      >
        <p class="m-0 text-[12px] text-ink-soft">
          {{ action().assignee?.name || 'unassigned' }}
          @if (action().plannedDate) {
            · planned for {{ date(action().plannedDate) }}
          }
          <!-- Only the states the rest of the card cannot already show. -->
          @if (standoutStatus(); as label) {
            · <span [style.color]="statusColour()">{{ label }}</span>
          }
        </p>

        <span class="flex items-center gap-4 text-[12px]">
          <button type="button" class="text-accent-bright" (click)="editing.emit()">
            Edit
          </button>
          <button type="button" class="text-overdue" (click)="removing.emit()">
            Delete
          </button>
        </span>
      </div>
    </article>
  `,
})
export class PlanCard {
  readonly action = input.required<ApiUpgradeAction>();

  readonly editing = output<void>();
  readonly removing = output<void>();
  readonly complete = output<string>();

  protected readonly date = formatDate;

  /** Which installations this touches — the thing the old card never said. */
  protected readonly customers = computed(() => {
    const names = [...new Set(this.action().environments.map((e) => e.project))];
    if (names.length === 0) {
      return 'no environments in scope';
    }
    const environments = this.action().environments.length;
    return `${names.join(', ')} · ${environments} environment${environments === 1 ? '' : 's'}`;
  });

  private readonly support = computed<SupportStatus>(() => {
    const days = this.action().daysToEol;
    if (days === null) {
      return 'UNKNOWN';
    }
    return days <= 0 ? 'EOL' : days <= 180 ? 'NEAR' : 'SUPPORTED';
  });

  protected readonly urgencyColour = computed(() => statusFill(this.support()));

  /** The number, in the largest type on the card. */
  protected readonly deadline = computed(() => {
    const days = this.action().daysToEol;
    if (days === null) {
      // In-house products have no published date. Saying so is better than a
      // dash, which reads as missing data rather than a property of the thing.
      return 'no date';
    }
    return formatDays(days);
  });

  protected readonly deadlineNote = computed(() => {
    const action = this.action();
    if (action.daysToEol === null) {
      return 'no published end of life';
    }
    return action.daysToEol <= 0
      ? `support ended ${formatDate(action.eolDate)}`
      : `support ends ${formatDate(action.eolDate)}`;
  });

  /**
   * The derived status, but only when it says something the card does not.
   *
   * The day count already conveys overdue and the Jira strip conveys progress,
   * so repeating those would be decoration. Completed and deferred are states
   * nothing else here expresses.
   */
  protected readonly standoutStatus = computed(() => {
    switch (this.action().derivedStatus) {
      case 'COMPLETED':
        return 'completed';
      case 'DEFERRED':
        return 'deferred';
      default:
        return null;
    }
  });

  protected readonly statusColour = computed(() =>
    this.action().derivedStatus === 'COMPLETED'
      ? 'var(--color-good)'
      : 'var(--color-ink-faint)',
  );

  /** Green only for a change the estate actually confirms. */
  protected envColour(env: ApiActionEnvironment): string {
    if (!env.completedAt) {
      return 'var(--color-rule)';
    }
    return env.verified ? 'var(--color-good)' : 'var(--color-overdue)';
  }
}
