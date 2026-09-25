import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiActionStep } from '../core/api';
import { RegistryStore } from '../core/registry.store';

/** Entry units. Stored as minutes; a platform upgrade is measured in days. */
const UNITS = [
  { key: 'm', label: 'minutes', minutes: 1 },
  { key: 'h', label: 'hours', minutes: 60 },
  { key: 'd', label: 'days', minutes: 60 * 8 },
  { key: 'w', label: 'weeks', minutes: 60 * 8 * 5 },
];

/**
 * The to-do list on an upgrade, as a timeline.
 *
 * Built in the same shape as the change history: entries threaded onto one
 * line, with state carried by the dot before any text is read.
 *
 * Sized for real upgrade work rather than an afternoon's tasks — effort
 * accumulates across many stretches, estimates are entered in days or weeks,
 * and a step waiting on someone else is distinct from one nobody has picked up.
 */
@Component({
  selector: 'lime-action-checklist',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="mt-4 border-t border-rule pt-4">
      <div class="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h3 class="m-0 text-[13px] font-semibold">To-do list</h3>
        @if (steps().length > 0) {
          <span class="tabular text-[12px] text-ink-soft">
            {{ doneCount() }}/{{ steps().length }} done
            @if (spent() > 0) {
              · {{ effort(spent()) }} spent
            }
            @if (estimatedLeft() > 0) {
              · {{ effort(estimatedLeft()) }} left
            }
            @if (blockedCount() > 0) {
              · <span class="text-overdue">{{ blockedCount() }} blocked</span>
            }
          </span>
        }
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
            class="step-item relative flex items-start gap-3 py-2.5"
            [style.animation-delay.ms]="$index * 40"
          >
            <!-- effort: what it has taken, or what it should -->
            <span class="tabular w-[62px] shrink-0 pt-0.5 text-right text-[12px]">
              @if (step.spentMinutes > 0) {
                <span [style.color]="step.overEstimate ? 'var(--color-soon)' : 'var(--color-ink)'">
                  {{ effort(step.spentMinutes) }}
                </span>
              } @else if (step.estimateMinutes) {
                <span class="text-ink-soft">~{{ effort(step.estimateMinutes) }}</span>
              } @else {
                <span class="text-ink-faint">—</span>
              }
            </span>

            <span class="relative z-10 flex h-[22px] w-[10px] shrink-0 items-center justify-center">
              <span
                class="h-[10px] w-[10px] rounded-full"
                [style.background]="dotColour(step)"
                [style.box-shadow]="
                  step.running
                    ? '0 0 0 3px var(--color-surface), 0 0 0 5px ' + dotColour(step)
                    : '0 0 0 3px var(--color-surface)'
                "
                aria-hidden="true"
              ></span>
            </span>

            <span class="min-w-0 flex-1">
              <span
                class="block text-[13.5px]"
                [class.line-through]="step.status === 'DONE'"
                [class.text-ink-faint]="step.status === 'DONE'"
                [class.font-medium]="step.isNext && step.status !== 'DONE'"
              >
                {{ step.title }}
              </span>

              <span class="block text-[11.5px] text-ink-soft">
                @if (step.status === 'DONE') {
                  {{ when(step.completedAt!) }}
                  @if (step.completedBy) {
                    · by {{ step.completedBy }}
                  }
                  @if (step.estimateMinutes) {
                    · estimated {{ effort(step.estimateMinutes) }}
                  }
                } @else {
                  @if (step.assignee) {
                    {{ step.assignee.name }}
                  }
                  @if (step.dueDate) {
                    @if (step.assignee) {
                      ·
                    }
                    <span [class.text-overdue]="step.overdue">
                      due {{ shortDate(step.dueDate) }}
                    </span>
                  }
                  @if (step.running) {
                    <span style="color: var(--color-accent-bright)"> · running</span>
                  }
                }
              </span>

              @if (step.status === 'BLOCKED' && step.blockedReason) {
                <span class="mt-0.5 block text-[11.5px]" style="color: var(--color-overdue)">
                  Blocked — {{ step.blockedReason }}
                </span>
              }

              @if (step.description) {
                <span class="mt-0.5 block text-[11.5px] text-ink-faint">
                  {{ step.description }}
                </span>
              }
            </span>

            <span class="flex shrink-0 flex-wrap justify-end gap-2 pt-0.5 text-[11.5px]">
              @if (step.status === 'DONE') {
                <button type="button" class="text-ink-faint hover:text-ink" (click)="reopen(step)">
                  Reopen
                </button>
              } @else {
                @if (step.running) {
                  <button type="button" class="text-ink-soft hover:text-ink" (click)="pause(step)">
                    Pause
                  </button>
                } @else {
                  <button type="button" class="text-accent-bright" (click)="start(step)">
                    Start
                  </button>
                }
                <button type="button" class="text-accent-bright" (click)="complete(step)">
                  Done
                </button>
                <button type="button" class="text-ink-faint hover:text-ink" (click)="openBlock(step)">
                  {{ step.status === 'BLOCKED' ? 'Unblock' : 'Block' }}
                </button>
                <button type="button" class="text-ink-faint hover:text-ink" (click)="openLog(step)">
                  Log
                </button>
                <button type="button" class="text-ink-faint hover:text-overdue" (click)="remove(step)">
                  ✕
                </button>
              }
            </span>
          </li>
        }
      </ol>

      <!-- blocking, and logging effort done away from the clock -->
      @if (blocking(); as step) {
        <form class="mt-2 flex flex-wrap gap-2" (submit)="saveBlock($event, step)">
          <input
            class="input mt-0 min-w-[220px] flex-1"
            [(ngModel)]="blockReason"
            name="blockreason"
            placeholder="What is it waiting on?"
          />
          <button type="submit" class="btn">Block</button>
          <button type="button" class="btn" (click)="blocking.set(null)">Cancel</button>
        </form>
      }

      @if (logging(); as step) {
        <form class="mt-2 flex flex-wrap items-center gap-2" (submit)="saveLog($event, step)">
          <span class="text-[12px] text-ink-soft">Add effort to “{{ step.title }}”</span>
          <input
            class="input tabular mt-0 w-[90px]"
            type="number"
            [(ngModel)]="logAmount"
            name="logamount"
            placeholder="0"
          />
          <select class="input mt-0 w-[120px]" [(ngModel)]="logUnit" name="logunit">
            @for (u of units; track u.key) {
              <option [value]="u.key">{{ u.label }}</option>
            }
          </select>
          <button type="submit" class="btn">Log</button>
          <button type="button" class="btn" (click)="logging.set(null)">Cancel</button>
        </form>
      }

      @if (error()) {
        <p class="m-0 mt-2 text-[12px] text-overdue" role="alert">{{ error() }}</p>
      }

      <!-- add a step -->
      <form class="mt-3 grid gap-2" (submit)="add($event)">
        <div class="flex flex-wrap gap-2">
          <input
            class="input mt-0 min-w-[200px] flex-1"
            [(ngModel)]="title"
            name="steptitle"
            placeholder="Add a step"
          />
          <input
            class="input tabular mt-0 w-[80px]"
            type="number"
            min="1"
            [(ngModel)]="estimate"
            name="stepestimate"
            placeholder="0"
            aria-label="Estimate"
          />
          <select class="input mt-0 w-[110px]" [(ngModel)]="estimateUnit" name="stepunit">
            @for (u of units; track u.key) {
              <option [value]="u.key">{{ u.label }}</option>
            }
          </select>
          <button type="button" class="btn" (click)="detailed.set(!detailed())">
            {{ detailed() ? 'Less' : 'More' }}
          </button>
          <button type="submit" class="btn btn-primary" [disabled]="busy()">Add</button>
        </div>

        @if (detailed()) {
          <div class="flex flex-wrap gap-2">
            <select class="input mt-0 w-[190px]" [(ngModel)]="assigneeId" name="stepassignee">
              <option value="">Unassigned</option>
              @for (e of engineers(); track e.id) {
                <option [value]="e.id">{{ e.name }}</option>
              }
            </select>
            <input
              class="input mt-0 w-[170px]"
              type="date"
              [(ngModel)]="dueDate"
              name="stepdue"
              aria-label="Due date"
            />
            <input
              class="input mt-0 min-w-[200px] flex-1"
              [(ngModel)]="description"
              name="stepdesc"
              placeholder="Notes for whoever picks it up"
            />
          </div>
        }
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
  private readonly store = inject(RegistryStore);

  readonly actionId = input.required<string>();

  protected readonly threadX = 67;
  protected readonly units = UNITS;
  protected readonly engineers = this.store.engineers;

  protected readonly steps = signal<ApiActionStep[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly estimate = signal<number | null>(null);
  protected readonly estimateUnit = signal('h');
  protected readonly dueDate = signal('');
  protected readonly assigneeId = signal('');
  protected readonly detailed = signal(false);

  protected readonly blocking = signal<ApiActionStep | null>(null);
  protected readonly blockReason = signal('');
  protected readonly logging = signal<ApiActionStep | null>(null);
  protected readonly logAmount = signal<number | null>(null);
  protected readonly logUnit = signal('h');

  protected readonly doneCount = computed(
    () => this.steps().filter((s) => s.status === 'DONE').length,
  );

  protected readonly blockedCount = computed(
    () => this.steps().filter((s) => s.status === 'BLOCKED').length,
  );

  /** Effort recorded so far, across every stretch of work. */
  protected readonly spent = computed(() =>
    this.steps().reduce((total, s) => total + s.spentMinutes, 0),
  );

  protected readonly estimatedLeft = computed(() =>
    this.steps()
      .filter((s) => s.status !== 'DONE')
      .reduce((total, s) => total + (s.estimateMinutes ?? 0), 0),
  );

  constructor() {
    queueMicrotask(() => this.load());
  }

  private load(): void {
    this.api.actionSteps(this.actionId()).subscribe({
      next: (steps) => this.steps.set(steps),
    });
  }

  private toMinutes(amount: number, unit: string): number {
    return Math.max(1, Math.round(amount * (UNITS.find((u) => u.key === unit)?.minutes ?? 1)));
  }

  protected add(event: Event): void {
    event.preventDefault();
    const title = this.title().trim();
    if (!title) {
      return;
    }

    const amount = this.estimate();

    this.busy.set(true);
    this.api
      .addActionStep(this.actionId(), {
        title,
        description: this.description().trim() || undefined,
        estimateMinutes: amount ? this.toMinutes(amount, this.estimateUnit()) : undefined,
        dueDate: this.dueDate() || undefined,
        assigneeId: this.assigneeId() || undefined,
      })
      .subscribe({
        next: (steps) => {
          this.steps.set(steps);
          this.title.set('');
          this.description.set('');
          this.estimate.set(null);
          this.dueDate.set('');
          this.assigneeId.set('');
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
        this.error.set(err.error?.message ?? 'Could not start that step.'),
    });
  }

  protected pause(step: ApiActionStep): void {
    this.api.pauseActionStep(this.actionId(), step.id).subscribe({
      next: (steps) => this.steps.set(steps),
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

  protected openBlock(step: ApiActionStep): void {
    // Already blocked, the button clears it rather than asking again.
    if (step.status === 'BLOCKED') {
      this.api.pauseActionStep(this.actionId(), step.id).subscribe({
        next: (steps) => this.steps.set(steps),
      });
      return;
    }
    this.blockReason.set('');
    this.logging.set(null);
    this.blocking.set(step);
  }

  protected saveBlock(event: Event, step: ApiActionStep): void {
    event.preventDefault();
    const reason = this.blockReason().trim();
    if (!reason) {
      return;
    }

    this.api.blockActionStep(this.actionId(), step.id, reason).subscribe({
      next: (steps) => {
        this.steps.set(steps);
        this.blocking.set(null);
      },
    });
  }

  protected openLog(step: ApiActionStep): void {
    this.logAmount.set(null);
    this.blocking.set(null);
    this.logging.set(step);
  }

  protected saveLog(event: Event, step: ApiActionStep): void {
    event.preventDefault();
    const amount = this.logAmount();
    if (!amount) {
      return;
    }

    this.api
      .logActionStepTime(this.actionId(), step.id, this.toMinutes(amount, this.logUnit()))
      .subscribe({
        next: (steps) => {
          this.steps.set(steps);
          this.logging.set(null);
        },
      });
  }

  protected dotColour(step: ApiActionStep): string {
    switch (step.status) {
      case 'DONE':
        return 'var(--color-good)';
      case 'BLOCKED':
        return 'var(--color-overdue)';
      case 'IN_PROGRESS':
        return 'var(--color-accent-bright)';
      default:
        return step.isNext ? 'var(--color-soon)' : 'var(--color-rule)';
    }
  }

  /** Days once it passes a working day: "3d 2h", not "1560m". */
  protected effort(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    if (minutes < 480) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
    }

    const days = Math.floor(minutes / 480);
    const hours = Math.round((minutes % 480) / 60);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  protected when(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected shortDate(iso: string): string {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
  }
}
