import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiActionStep } from '../core/api';

/**
 * The to-do list on an upgrade, as a timeline.
 *
 * Built in the same shape as the change history: entries threaded onto one
 * line, with the state carried by the dot before any text is read. An upgrade
 * is a sequence, and a sequence reads better as a thread than as a table.
 *
 * One step runs at a time. The next one to pick up is marked, and everything
 * below it is waiting — which is what working through a list one by one
 * actually looks like.
 */
@Component({
  selector: 'lime-action-checklist',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="mt-4 border-t border-rule pt-4">
      <div class="mb-1 flex flex-wrap items-baseline justify-between gap-3">
        <h3 class="m-0 text-[13px] font-semibold">To-do list</h3>
        <span class="tabular text-[12px] text-ink-soft">
          @if (steps().length > 0) {
            {{ doneCount() }}/{{ steps().length }} done
            @if (spent() > 0) {
              · {{ asDuration(spent()) }} spent
            }
            @if (remaining() > 0) {
              · {{ asDuration(remaining()) }} estimated left
            }
          }
        </span>
      </div>

      <ol class="relative m-0 list-none p-0">
        @if (steps().length > 1) {
          <span
            class="absolute top-3 bottom-3 w-px"
            [style.left.px]="threadX"
            style="background: var(--color-rule)"
            aria-hidden="true"
          ></span>
        }

        @for (step of steps(); track step.id) {
          <li
            class="step-item relative flex items-start gap-4 py-2.5"
            [style.animation-delay.ms]="$index * 40"
          >
            <!-- time column: what it took, or what it should take -->
            <span
              class="tabular w-[62px] shrink-0 pt-0.5 text-right text-[12px]"
              [class.text-ink-soft]="!step.actualMinutes"
              [style.color]="step.actualMinutes ? overran(step) : null"
            >
              @if (step.actualMinutes) {
                {{ asDuration(step.actualMinutes) }}
              } @else if (step.estimateMinutes) {
                ~{{ asDuration(step.estimateMinutes) }}
              } @else {
                —
              }
            </span>

            <span class="relative z-10 flex h-[22px] w-[10px] shrink-0 items-center justify-center">
              <span
                class="rounded-full"
                [class.h-\\[10px\\]]="true"
                [class.w-\\[10px\\]]="true"
                [style.background]="dotColour(step)"
                [style.box-shadow]="
                  step.isNext && !step.completedAt
                    ? '0 0 0 3px var(--color-surface), 0 0 0 5px ' + dotColour(step)
                    : '0 0 0 3px var(--color-surface)'
                "
                aria-hidden="true"
              ></span>
            </span>

            <span class="min-w-0 flex-1">
              <span
                class="block text-[13.5px]"
                [class.line-through]="!!step.completedAt"
                [class.text-ink-faint]="!!step.completedAt"
                [class.font-medium]="step.isNext && !step.completedAt"
              >
                {{ step.title }}
              </span>

              <span class="block text-[11.5px] text-ink-soft">
                @if (step.completedAt) {
                  {{ when(step.completedAt) }}
                  @if (step.completedBy) {
                    · by {{ step.completedBy }}
                  }
                  @if (step.actualMinutes && step.estimateMinutes) {
                    · estimated {{ asDuration(step.estimateMinutes) }}
                  }
                } @else if (step.inProgress) {
                  <span style="color: var(--color-accent-bright)">
                    running since {{ when(step.startedAt!) }}
                  </span>
                } @else if (step.isNext) {
                  next up
                } @else {
                  waiting
                }
              </span>

              @if (step.note) {
                <span class="block text-[11.5px] text-ink-faint">{{ step.note }}</span>
              }
            </span>

            <!-- one at a time: only the running step can be finished -->
            <span class="flex shrink-0 gap-2 pt-0.5 text-[11.5px]">
              @if (step.completedAt) {
                <button type="button" class="text-ink-faint hover:text-ink" (click)="reopen(step)">
                  Reopen
                </button>
              } @else if (step.inProgress) {
                <button type="button" class="text-accent-bright" (click)="complete(step)">
                  Done
                </button>
              } @else {
                <button type="button" class="text-accent-bright" (click)="start(step)">
                  Start
                </button>
                <button type="button" class="text-ink-faint hover:text-overdue" (click)="remove(step)">
                  ✕
                </button>
              }
            </span>
          </li>
        } @empty {
          <li class="py-2 text-[12.5px] text-ink-soft">
            Nothing on the list yet. Break the upgrade into the steps someone
            would actually work through.
          </li>
        }
      </ol>

      @if (error()) {
        <p class="m-0 mt-2 text-[12px] text-overdue" role="alert">{{ error() }}</p>
      }

      <form class="mt-3 flex flex-wrap gap-2" (submit)="add($event)">
        <input
          class="input mt-0 min-w-[200px] flex-1"
          [(ngModel)]="title"
          name="steptitle"
          placeholder="Add a step…"
        />
        <input
          class="input tabular mt-0 w-[110px]"
          type="number"
          min="1"
          [(ngModel)]="estimate"
          name="stepestimate"
          placeholder="mins"
          aria-label="Estimated minutes"
        />
        <button type="submit" class="btn" [disabled]="busy()">Add</button>
      </form>
    </div>
  `,
  styles: `
    .step-item {
      animation: step-rise 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes step-rise {
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
export class ActionChecklist {
  private readonly api = inject(Api);

  readonly actionId = input.required<string>();

  protected readonly threadX = 67;

  protected readonly steps = signal<ApiActionStep[]>([]);
  protected readonly title = signal('');
  protected readonly estimate = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly doneCount = computed(
    () => this.steps().filter((s) => s.completedAt).length,
  );

  /** Time actually spent, from recorded start and finish times. */
  protected readonly spent = computed(() =>
    this.steps().reduce((total, s) => total + (s.actualMinutes ?? 0), 0),
  );

  /** What the unfinished steps were estimated at. */
  protected readonly remaining = computed(() =>
    this.steps()
      .filter((s) => !s.completedAt)
      .reduce((total, s) => total + (s.estimateMinutes ?? 0), 0),
  );

  constructor() {
    // Loaded per action rather than with the list: most cards are collapsed
    // reading, and a checklist fetch per card on every page load would be a
    // request each for nothing.
    queueMicrotask(() => this.load());
  }

  private load(): void {
    this.api.actionSteps(this.actionId()).subscribe({
      next: (steps) => this.steps.set(steps),
    });
  }

  protected add(event: Event): void {
    event.preventDefault();
    const title = this.title().trim();
    if (!title) {
      return;
    }

    this.busy.set(true);
    this.api
      .addActionStep(this.actionId(), {
        title,
        estimateMinutes: this.estimate() ?? undefined,
      })
      .subscribe({
        next: (steps) => {
          this.steps.set(steps);
          this.title.set('');
          this.estimate.set(null);
          this.busy.set(false);
        },
        error: () => this.busy.set(false),
      });
  }

  protected start(step: ApiActionStep): void {
    this.error.set(null);
    this.api.startActionStep(this.actionId(), step.id).subscribe({
      next: (steps) => this.steps.set(steps),
      error: (err: { error?: { message?: string } }) =>
        // The one-at-a-time rule is enforced server-side; this is where the
        // person finds out which step is holding things up.
        this.error.set(err.error?.message ?? 'Could not start that step.'),
    });
  }

  protected complete(step: ApiActionStep): void {
    this.api.completeActionStep(this.actionId(), step.id).subscribe({
      next: (steps) => this.steps.set(steps),
    });
  }

  protected reopen(step: ApiActionStep): void {
    this.api.reopenActionStep(this.actionId(), step.id).subscribe({
      next: (steps) => this.steps.set(steps),
    });
  }

  protected remove(step: ApiActionStep): void {
    this.api.removeActionStep(this.actionId(), step.id).subscribe({
      next: (steps) => this.steps.set(steps),
    });
  }

  protected dotColour(step: ApiActionStep): string {
    if (step.completedAt) {
      return 'var(--color-good)';
    }
    if (step.inProgress) {
      return 'var(--color-accent-bright)';
    }
    return step.isNext ? 'var(--color-soon)' : 'var(--color-rule)';
  }

  /** Red when it took longer than estimated — the reason to record durations. */
  protected overran(step: ApiActionStep): string | null {
    if (!step.actualMinutes || !step.estimateMinutes) {
      return null;
    }
    return step.actualMinutes > step.estimateMinutes
      ? 'var(--color-soon)'
      : 'var(--color-good)';
  }

  protected asDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  }

  protected when(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
