import { Component, computed, input, output } from '@angular/core';
import { ApiUpgradeAction } from '../core/api';
import { formatDate, formatDays, statusFill, SupportStatus } from '../core/lifecycle';
import { JiraPanel } from './jira-panel';
import { Modal } from './modal';

/**
 * One plan, opened from the board.
 *
 * Laid out as plan against reality, because the gap between them is the only
 * thing here Jira could not tell you. Everything below that divider is the
 * Jira panel unchanged — the same list, the same add form.
 *
 * Note what it ends with rather than contains: comments and attachments are a
 * link to Jira, not a thread and an uploader. Rebuilding those would recreate
 * the parallel task system this replaced, and there is nowhere to put a file.
 */
@Component({
  selector: 'lime-plan-detail',
  imports: [Modal, JiraPanel],
  host: { class: 'block' },
  template: `
    <lime-modal
      [title]="heading()"
      [subtitle]="subheading()"
      [maxWidth]="820"
      (dismiss)="close.emit()"
    >
      <!-- how far the work has got, as Jira reports it -->
      @if (progress(); as bar) {
        <div class="mb-4">
          <span class="block h-[5px] w-full overflow-hidden rounded-full bg-elevated">
            <span
              class="block h-full rounded-full"
              style="background: var(--color-good)"
              [style.width.%]="bar.percent"
            ></span>
          </span>
          <p class="tabular m-0 mt-1.5 text-[12px] text-ink-soft">{{ bar.label }}</p>
        </div>
      }

      <div class="grid gap-5 sm:grid-cols-2">
        <section>
          <h3 class="m-0 mb-2 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
            The plan
          </h3>
          <dl class="m-0 grid gap-1.5 text-[12.5px]">
            <div class="flex justify-between gap-3">
              <dt class="text-ink-soft">Target</dt>
              <dd class="tabular m-0">{{ action().targetVersion || 'not set' }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-ink-soft">By</dt>
              <dd class="tabular m-0">{{ date(action().plannedDate) }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-ink-soft">Support ends</dt>
              <dd class="tabular m-0" [style.color]="urgencyColour()">
                {{ supportLine() }}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-ink-soft">Owner</dt>
              <dd class="m-0">{{ action().assignee?.name || 'unassigned' }}</dd>
            </div>
          </dl>

          @if (action().planTooLate) {
            <p class="m-0 mt-2.5 text-[12px]" style="color: var(--color-soon)">
              This plan finishes after support ends.
            </p>
          }
        </section>

        <section>
          <h3 class="m-0 mb-2 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
            What actually happened
          </h3>
          <ul class="m-0 grid list-none gap-1.5 p-0 text-[12.5px]">
            @for (env of action().environments; track env.deploymentId) {
              <li class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-2">
                  <span
                    class="inline-block h-[7px] w-[7px] rounded-full"
                    [style.background]="
                      !env.completedAt
                        ? 'var(--color-rule)'
                        : env.verified
                          ? 'var(--color-good)'
                          : 'var(--color-overdue)'
                    "
                  ></span>
                  {{ env.environment }}
                </span>
                <span class="text-[11.5px] text-ink-soft">
                  @if (!env.completedAt) {
                    nothing recorded
                  } @else if (env.verified) {
                    version change recorded
                  } @else {
                    marked done, nothing recorded
                  }
                </span>
              </li>
            } @empty {
              <li class="text-ink-faint">No environments in scope.</li>
            }
          </ul>

          @if (action().unverifiedCompletion) {
            <p class="m-0 mt-2.5 text-[12px]" style="color: var(--color-overdue)">
              Something is ticked off with no version change behind it.
            </p>
          }
        </section>
      </div>

      <!-- the work itself, mirrored from Jira, with the add form -->
      <lime-jira-panel [actionId]="action().id" />

      <p class="m-0 mt-4 border-t border-rule pt-3 text-[11.5px] text-ink-faint">
        Comments, attachments and time logs live in Jira.
        @if (action().jiraKey) {
          Open
          <span class="tabular">{{ action().jiraKey }}</span>
          to add them.
        }
      </p>
    </lime-modal>
  `,
})
export class PlanDetail {
  readonly action = input.required<ApiUpgradeAction>();
  readonly close = output<void>();

  protected readonly date = formatDate;

  protected readonly heading = computed(
    () =>
      `${this.action().technology} ${this.action().cycle} → ${this.action().targetVersion || '?'}`,
  );

  protected readonly subheading = computed(() => {
    const names = [...new Set(this.action().environments.map((e) => e.project))];
    return names.length > 0 ? names.join(', ') : 'no environments in scope';
  });

  private readonly support = computed<SupportStatus>(() => {
    const days = this.action().daysToEol;
    if (days === null) {
      return 'UNKNOWN';
    }
    return days <= 0 ? 'EOL' : days <= 180 ? 'NEAR' : 'SUPPORTED';
  });

  protected readonly urgencyColour = computed(() => statusFill(this.support()));

  protected readonly supportLine = computed(() => {
    const action = this.action();
    if (action.daysToEol === null) {
      return 'no published date';
    }
    return `${formatDate(action.eolDate)} (${formatDays(action.daysToEol)})`;
  });

  /** Null when nothing is linked — an empty bar would claim no progress. */
  protected readonly progress = computed(() => {
    const action = this.action();
    const total = action.jiraSubtaskTotal;
    if (!action.jiraKey || !total) {
      return null;
    }

    const done = action.jiraSubtaskDone ?? 0;
    return {
      percent: Math.round((done / total) * 100),
      label: `${done} of ${total} steps done in ${action.jiraKey}`,
    };
  });
}
