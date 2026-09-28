import { Component, computed, input, output } from '@angular/core';
import { ApiActionEnvironment, ApiUpgradeAction } from '../core/api';
import { formatDays, statusFill, statusOf } from '../core/lifecycle';
import { PlanTimeline } from './plan-timeline';
import { TechIcon } from './tech-icon';

type Stage = 'planned' | 'jira' | 'deployed' | 'verified';

interface Column {
  key: Stage;
  label: string;
  /** Nothing can be moved into this one. */
  locked: boolean;
  hint: string;
}

const COLUMNS: Column[] = [
  { key: 'planned', label: 'Planned', locked: false, hint: 'No issue linked yet' },
  { key: 'jira', label: 'In Jira', locked: false, hint: 'Work broken down and running' },
  {
    key: 'deployed',
    label: 'Deployed',
    locked: false,
    hint: 'Marked done on at least one environment',
  },
  {
    key: 'verified',
    label: 'Verified',
    locked: true,
    hint: 'Every environment confirmed by a recorded version change',
  },
];

/**
 * Every plan on one board, along its own lifecycle rather than Jira's.
 *
 * The columns are deliberately not Jira statuses. Copying Jira's board would
 * leave no honest answer to "why not just open Jira?" — these four stages are
 * ours, and only this registry can put a card in the last one.
 *
 * Verified is locked. Nothing drags into it and no button puts it there: a
 * plan arrives once every environment it covers has a recorded version change
 * behind it. That rule is the reason this tool exists beside a ticket board,
 * so it is expressed as an interaction rather than a paragraph.
 */
@Component({
  selector: 'lime-plan-board',
  imports: [PlanTimeline, TechIcon],
  host: { class: 'block' },
  template: `
    <section class="card mb-4 px-5 py-4">
      <lime-plan-timeline [actions]="actions()" />
    </section>

    <div class="board-columns grid gap-3">
      @for (column of columns; track column.key) {
        <section class="card flex min-h-[220px] flex-col px-3 py-3">
          <header class="mb-2.5 flex items-baseline justify-between gap-2">
            <h3 class="m-0 flex items-center gap-1.5 text-[12px] font-semibold">
              {{ column.label }}
              @if (column.locked) {
                <span class="text-[11px] text-ink-faint" [attr.title]="column.hint">&#128274;</span>
              }
            </h3>
            <span class="tabular text-[11.5px] text-ink-faint">
              {{ inColumn(column.key).length }}
            </span>
          </header>

          <div class="flex flex-col gap-2">
            @for (action of inColumn(column.key); track action.id) {
              <article
                class="board-card cursor-pointer rounded-xl border border-rule px-2.5 py-2"
                [attr.aria-label]="action.technology + ' ' + action.cycle"
                (click)="open.emit(action)"
              >
                <!-- Tags carry identity, never status, so they stay neutral. -->
                <p class="m-0 flex flex-wrap items-center gap-1">
                  <span class="chip">{{ action.technology }}</span>
                  @if (customerOf(action); as customer) {
                    <span class="chip">{{ customer }}</span>
                  }
                </p>

                <p class="m-0 mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug">
                  <lime-tech-icon [technology]="action.technology" [size]="15" />
                  <span class="min-w-0">
                    {{ action.cycle }} &rarr; {{ action.targetVersion || '?' }}
                  </span>
                </p>

                @if (progressOf(action); as progress) {
                  <span class="mt-2 block h-[3px] w-full overflow-hidden rounded-full bg-elevated">
                    <span
                      class="block h-full rounded-full"
                      style="background: var(--color-good)"
                      [style.width.%]="progress.percent"
                    ></span>
                  </span>
                  <p class="tabular m-0 mt-1 text-[10.5px] text-ink-faint">
                    {{ progress.label }}
                  </p>
                }

                <!-- Where the estate actually is: one dot per environment. -->
                <p class="m-0 mt-2 flex items-center justify-between gap-2">
                  <span class="flex items-center gap-1" [attr.title]="envTitle(action)">
                    @for (env of action.environments; track env.deploymentId) {
                      <span
                        class="inline-block h-[7px] w-[7px] rounded-full"
                        [style.background]="envColour(env)"
                      ></span>
                    }
                  </span>
                  <span class="tabular text-[10.5px]" [style.color]="urgencyColour(action)">
                    {{ deadline(action) }}
                  </span>
                </p>
              </article>
            } @empty {
              <p class="m-0 px-1 py-3 text-[11px] text-ink-faint">{{ column.hint }}</p>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .board-columns {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .board-card {
      background: color-mix(in oklab, var(--color-elevated) 40%, transparent);
      transition:
        border-color 160ms ease,
        transform 160ms ease;
    }

    .board-card:hover {
      border-color: color-mix(in oklab, var(--color-accent-bright) 55%, transparent);
      transform: translateY(-1px);
    }

    .chip {
      border: 1px solid var(--color-rule);
      border-radius: 999px;
      color: var(--color-ink-soft);
      font-size: 10px;
      letter-spacing: 0.02em;
      padding: 1px 6px;
      text-transform: uppercase;
    }

    @media (max-width: 1100px) {
      .board-columns {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 620px) {
      .board-columns {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class PlanBoard {
  readonly actions = input.required<ApiUpgradeAction[]>();
  readonly open = output<ApiUpgradeAction>();

  protected readonly columns = COLUMNS;

  private readonly byStage = computed(() => {
    const groups: Record<Stage, ApiUpgradeAction[]> = {
      planned: [],
      jira: [],
      deployed: [],
      verified: [],
    };

    for (const action of this.actions()) {
      groups[stageOf(action)].push(action);
    }

    // Most urgent first within a column; anything without a date sinks.
    for (const key of Object.keys(groups) as Stage[]) {
      groups[key].sort(
        (a, b) =>
          (a.daysToEol ?? Number.MAX_SAFE_INTEGER) -
          (b.daysToEol ?? Number.MAX_SAFE_INTEGER),
      );
    }

    return groups;
  });

  protected inColumn(stage: Stage): ApiUpgradeAction[] {
    return this.byStage()[stage];
  }

  protected customerOf(action: ApiUpgradeAction): string | null {
    const names = [...new Set(action.environments.map((e) => e.project))];
    if (names.length === 0) {
      return null;
    }
    return names.length === 1 ? names[0] : `${names.length} customers`;
  }

  /**
   * Jira progress, or nothing.
   *
   * Absent rather than zero when no issue is linked: an empty bar reads as
   * "no progress", which is a different claim from "nobody has broken this
   * down yet".
   */
  protected progressOf(
    action: ApiUpgradeAction,
  ): { percent: number; label: string } | null {
    const total = action.jiraSubtaskTotal;
    if (!action.jiraKey || !total) {
      return null;
    }

    const done = action.jiraSubtaskDone ?? 0;
    return {
      percent: Math.round((done / total) * 100),
      label: `${done}/${total} in ${action.jiraKey}`,
    };
  }

  protected envTitle(action: ApiUpgradeAction): string {
    return action.environments
      .map((e) => `${e.environment}: ${envState(e)}`)
      .join(' · ');
  }

  protected envColour(env: ApiActionEnvironment): string {
    if (!env.completedAt) {
      return 'var(--color-rule)';
    }
    return env.verified ? 'var(--color-good)' : 'var(--color-overdue)';
  }

  protected urgencyColour(action: ApiUpgradeAction): string {
    return statusFill(statusOf(action.daysToEol));
  }

  protected deadline(action: ApiUpgradeAction): string {
    return action.daysToEol === null ? 'no date' : formatDays(action.daysToEol);
  }
}

/**
 * Which column a plan belongs in.
 *
 * Read in order: evidence beats a tick, a tick beats a ticket, and a ticket
 * beats an intention.
 */
function stageOf(action: ApiUpgradeAction): Stage {
  const envs = action.environments;

  if (envs.length > 0 && envs.every((e) => e.verified)) {
    return 'verified';
  }
  if (envs.some((e) => e.completedAt)) {
    return 'deployed';
  }
  return action.jiraKey ? 'jira' : 'planned';
}

function envState(env: ApiActionEnvironment): string {
  if (!env.completedAt) {
    return 'not started';
  }
  return env.verified ? 'recorded' : 'marked done, nothing recorded';
}

