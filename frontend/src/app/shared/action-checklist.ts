import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiActionStep } from '../core/api';
import { RegistryStore } from '../core/registry.store';

/**
 * The to-do list on an upgrade, as a timeline.
 *
 * Built in the same shape as the change history: entries threaded onto one
 * line, with state carried by the dot before any text is read.
 *
 * Sized for real upgrade work rather than an afternoon's tasks — effort
 * accumulates across many stretches rather than one span, a finish date is
 * picked off a calendar rather than added up from a duration, and a step
 * waiting on someone else is distinct from one nobody has picked up.
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
            <!-- effort recorded against this step -->
            <span class="tabular w-[62px] shrink-0 pt-0.5 text-right text-[12px]">
              @if (step.spentMinutes > 0) {
                {{ effort(step.spentMinutes) }}
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

              @if (step.description) {
                <span class="mt-0.5 block text-[11.5px] text-ink-faint">
                  {{ step.description }}
                </span>
              }
            </span>

            <span class="flex shrink-0 items-center gap-2 pt-0.5 text-[11.5px]">
              @if (step.status === 'DONE') {
                <button type="button" class="text-ink-faint hover:text-ink" (click)="reopen(step)">
                  Reopen
                </button>
              } @else {
                @if (!step.running) {
                  <button type="button" class="text-accent-bright" (click)="start(step)">
                    In progress
                  </button>
                }
                <button type="button" class="text-accent-bright" (click)="complete(step)">
                  Done
                </button>
                <button type="button" class="text-ink-faint hover:text-overdue" (click)="remove(step)">
                  ✕
                </button>
              }
            </span>
          </li>
        }
      </ol>

      @if (error()) {
        <p class="m-0 mt-2 text-[12px] text-overdue" role="alert">{{ error() }}</p>
      }

      <!-- add a step: one row, columns sized to what each part needs -->
      <form
        class="mt-3 grid items-center gap-2"
        style="grid-template-columns: minmax(0, 1fr) 150px 150px auto"
        (submit)="add($event)"
      >
        <input
          class="input mt-0"
          [(ngModel)]="title"
          name="steptitle"
          placeholder="Add a step"
        />
        <select class="input mt-0" [(ngModel)]="assigneeId" name="stepassignee">
          <option value="">Unassigned</option>
          @for (e of engineers(); track e.id) {
            <option [value]="e.id">{{ e.name }}</option>
          }
        </select>
        <input
          class="input mt-0"
          type="date"
          [(ngModel)]="dueDate"
          name="stepdue"
          aria-label="Finish by"
          title="Finish by"
        />
        <button type="submit" class="btn btn-primary" [disabled]="busy()">Add</button>
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
  protected readonly engineers = this.store.engineers;

  protected readonly steps = signal<ApiActionStep[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly title = signal('');
  protected readonly dueDate = signal('');
  protected readonly assigneeId = signal('');


  protected readonly doneCount = computed(
    () => this.steps().filter((s) => s.status === 'DONE').length,
  );

  /** Effort recorded so far, across every stretch of work. */
  protected readonly spent = computed(() =>
    this.steps().reduce((total, s) => total + s.spentMinutes, 0),
  );

  constructor() {
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
        dueDate: this.dueDate() || undefined,
        assigneeId: this.assigneeId() || undefined,
      })
      .subscribe({
        next: (steps) => {
          this.steps.set(steps);
          this.title.set('');
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
    switch (step.status) {
      case 'DONE':
        return 'var(--color-good)';
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
