import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, ApiUpgradeAction } from '../../core/api';
import { formatDate, formatDays, statusFill, SupportStatus } from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';
import { Modal } from '../../shared/modal';
import { TechIcon } from '../../shared/tech-icon';

const STATUSES = ['NOT_STARTED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED'];

const COMMS = [
  { key: 'NOT_REQUIRED', label: 'Not required' },
  { key: 'PENDING', label: 'To be sent' },
  { key: 'SENT', label: 'Sent' },
  { key: 'ACKNOWLEDGED', label: 'Acknowledged' },
];

interface Draft {
  id?: string;
  technology: string;
  technologyCycleId: string;
  targetVersion: string;
  status: string;
  plannedDate: string;
  assigneeId: string;
  jiraKey: string;
  customerComm: string;
  customerCommNotes: string;
  remarks: string;
  deploymentIds: string[];
}

/**
 * The work half of the tool.
 *
 * Deadlines are facts; these are what the team does about them. Unlike a ticket
 * board, each one is checked against what the estate actually records — a plan
 * marked complete with no matching change is shown as such rather than taken at
 * its word.
 */
@Component({
  selector: 'lime-actions',
  imports: [FormsModule, Modal, TechIcon],
  host: { class: 'block' },
  template: `
    <section class="card mb-5 flex flex-wrap items-start justify-between gap-4 px-7 py-6">
      <div>
        <h1 class="m-0 text-[30px] font-semibold tracking-[-0.02em]">Upgrade actions</h1>
        <p class="m-0 text-[14px] text-ink-soft">
          {{ open().length }} open · {{ overdue().length }} overdue ·
          {{ done().length }} completed
          @if (unverified().length > 0) {
            ·
            <span class="text-overdue">
              {{ unverified().length }} complete but unrecorded
            </span>
          }
        </p>
      </div>
      <button type="button" class="btn btn-primary" (click)="create()">New action</button>
    </section>

    @if (api.actionsResource.error()) {
      <p class="card mb-5 px-7 py-4 text-[14px] text-overdue" role="alert">
        Could not load upgrade actions from the API.
      </p>
    }

    <section class="card mb-5 flex flex-wrap items-center gap-3 px-7 py-4">
      <input
        type="search"
        [(ngModel)]="query"
        placeholder="Search technology, ticket or assignee"
        aria-label="Search actions"
        class="input mt-0 min-w-[240px] flex-1 rounded-full"
      />
      <div class="glass flex flex-wrap gap-1 rounded-full border border-rule bg-elevated p-1">
        @for (f of filters; track f) {
          <button
            type="button"
            class="rounded-full px-3.5 py-1.5 text-[13px] capitalize"
            [class.bg-ink]="filter() === f"
            [class.text-ground]="filter() === f"
            [class.text-ink-soft]="filter() !== f"
            (click)="filter.set(f)"
          >
            {{ f.toLowerCase() }}
          </button>
        }
      </div>
    </section>

    <div class="grid gap-4">
      @for (action of filtered(); track action.id) {
        <article class="card px-6 py-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex min-w-0 items-start gap-3">
              <lime-tech-icon [technology]="action.technology" [size]="30" />
              <div class="min-w-0">
                <h2 class="m-0 text-[17px] font-semibold">
                  {{ action.technology }} {{ action.cycle }}
                  <span class="text-ink-soft">→ {{ action.targetVersion || 'no target' }}</span>
                </h2>
                <p class="tabular m-0 text-[12.5px] text-ink-soft">
                  {{ action.jiraKey || 'no ticket' }} ·
                  {{ action.assignee?.name || 'unassigned' }}
                  @if (action.eolDate) {
                    · support ends {{ date(action.eolDate) }}
                    <span [style.color]="fill(statusOf(action.daysToEol))">
                      ({{ days(action.daysToEol) }})
                    </span>
                  }
                </p>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <span
                class="rounded-full border px-3 py-1 text-[12px] capitalize"
                [style.border-color]="statusColour(action.derivedStatus)"
                [style.color]="statusColour(action.derivedStatus)"
              >
                {{ action.derivedStatus.toLowerCase().replace('_', ' ') }}
              </span>
              <button type="button" class="text-[12px] text-accent-bright" (click)="edit(action)">
                Edit
              </button>
              <button
                type="button"
                class="text-[12px] text-overdue"
                (click)="confirmDelete.set(action)"
              >
                Delete
              </button>
            </div>
          </div>

          <!-- the two findings a ticket board cannot make -->
          @if (action.planTooLate) {
            <p
              class="m-0 mt-3 rounded-xl border px-3 py-2 text-[12.5px]"
              style="border-color: var(--color-soon); color: var(--color-soon)"
            >
              This plan finishes after support ends — the environments would run
              unsupported in between.
            </p>
          }
          @if (action.unverifiedCompletion) {
            <p
              class="m-0 mt-3 rounded-xl border px-3 py-2 text-[12.5px]"
              style="border-color: var(--color-overdue); color: var(--color-overdue)"
            >
              Marked complete, but no matching version change is recorded. Either
              it did not happen, or it was not written down.
            </p>
          }

          <!-- per-environment progress -->
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <span class="tabular text-[12px] text-ink-soft">
              {{ action.progress.done }}/{{ action.progress.total }} environments
            </span>
            @for (env of action.environments; track env.deploymentId) {
              <button
                type="button"
                class="glass flex items-center gap-2 rounded-full border px-3 py-1 text-[12px]"
                [style.border-color]="
                  env.completedAt
                    ? env.verified
                      ? 'var(--color-good)'
                      : 'var(--color-overdue)'
                    : null
                "
                [disabled]="!!env.completedAt"
                [attr.title]="
                  env.completedAt
                    ? env.verified
                      ? 'Done, and confirmed by a recorded change'
                      : 'Marked done, but nothing is recorded'
                    : 'Mark ' + env.environment + ' done'
                "
                (click)="completeEnvironment(action, env.deploymentId)"
              >
                {{ env.environment }}
                @if (env.completedAt) {
                  <span
                    [style.color]="env.verified ? 'var(--color-good)' : 'var(--color-overdue)'"
                    >{{ env.verified ? '✓' : '!' }}</span
                  >
                } @else {
                  <span class="text-ink-faint">mark done</span>
                }
              </button>
            }
          </div>

          @if (action.remarks || action.customerComm !== 'NOT_REQUIRED') {
            <dl class="m-0 mt-4 grid gap-2 border-t border-rule pt-3 text-[12.5px] sm:grid-cols-2">
              @if (action.customerComm !== 'NOT_REQUIRED') {
                <div>
                  <dt class="m-0 text-ink-soft">Customer communication</dt>
                  <dd class="m-0">
                    {{ commLabel(action.customerComm) }}
                    @if (action.customerCommNotes) {
                      <span class="block text-ink-soft">{{ action.customerCommNotes }}</span>
                    }
                  </dd>
                </div>
              }
              @if (action.remarks) {
                <div>
                  <dt class="m-0 text-ink-soft">Remarks</dt>
                  <dd class="m-0">{{ action.remarks }}</dd>
                </div>
              }
            </dl>
          }
        </article>
      } @empty {
        <p class="card px-7 py-10 text-center text-[14px] text-ink-soft">
          @if (api.actionsResource.isLoading()) {
            Loading…
          } @else {
            No action matches.
            <button type="button" class="text-accent-bright" (click)="create()">Create one</button>.
          }
        </p>
      }
    </div>

    <!-- create / edit -->
    @if (draft(); as form) {
      <lime-modal
        [title]="form.id ? 'Edit action' : 'New upgrade action'"
        subtitle="Plan the work against a cycle that is running out of support."
        (dismiss)="closeDraft()"
      >
        <form class="grid gap-4" (submit)="save($event)">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="field">
              Technology
              <select
                class="input"
                [(ngModel)]="form.technology"
                name="technology"
                (change)="onTechnology()"
              >
                <option value="">Choose…</option>
                @for (t of technologies(); track t.id) {
                  <option [value]="t.name">{{ t.name }}</option>
                }
              </select>
            </label>
            <label class="field">
              Cycle running out
              <select class="input" [(ngModel)]="form.technologyCycleId" name="cycle">
                <option value="">Choose…</option>
                @for (c of cyclesFor(form.technology); track c.id) {
                  <option [value]="c.id">{{ c.cycle }} — ends {{ date(c.eolDate) }}</option>
                }
              </select>
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <label class="field">
              Target version
              <input
                class="input tabular"
                [(ngModel)]="form.targetVersion"
                name="target"
                placeholder="28.5.2"
              />
            </label>
            <label class="field">
              Status
              <select class="input" [(ngModel)]="form.status" name="status">
                @for (s of statuses; track s) {
                  <option [value]="s">{{ s.toLowerCase().replace('_', ' ') }}</option>
                }
              </select>
            </label>
            <label class="field">
              Planned date
              <input type="date" class="input" [(ngModel)]="form.plannedDate" name="planned" />
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="field">
              Assignee
              <select class="input" [(ngModel)]="form.assigneeId" name="assignee">
                <option value="">Unassigned</option>
                @for (e of engineers(); track e.id) {
                  <option [value]="e.id">{{ e.name }}</option>
                }
              </select>
            </label>
            <label class="field">
              Jira / change request
              <input
                class="input tabular"
                [(ngModel)]="form.jiraKey"
                name="jira"
                placeholder="LIME-1042"
              />
            </label>
          </div>

          <fieldset class="m-0 border-0 p-0">
            <legend class="mb-2 p-0 text-[12px] text-ink-soft">Environments affected</legend>
            <div class="scroll-hidden flex max-h-[150px] flex-wrap gap-2 overflow-y-auto">
              @for (d of deployments(); track d.id) {
                <button
                  type="button"
                  class="glass rounded-full border px-3 py-1.5 text-[12px]"
                  [class.border-accent]="form.deploymentIds.includes(d.id)"
                  [class.border-rule]="!form.deploymentIds.includes(d.id)"
                  (click)="toggleDeployment(d.id)"
                >
                  {{ d.customer }} {{ d.environment }}
                </button>
              }
            </div>
          </fieldset>

          <!-- 2.5: customer communication, and remarks -->
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="field">
              Customer communication
              <select class="input" [(ngModel)]="form.customerComm" name="comm">
                @for (c of comms; track c.key) {
                  <option [value]="c.key">{{ c.label }}</option>
                }
              </select>
            </label>
            <label class="field">
              Communication notes
              <input
                class="input"
                [(ngModel)]="form.customerCommNotes"
                name="commnotes"
                placeholder="Window agreed with the customer"
              />
            </label>
          </div>

          <label class="field">
            Remarks
            <input
              class="input"
              [(ngModel)]="form.remarks"
              name="remarks"
              placeholder="Anything the next person needs to know"
            />
          </label>

          @if (error()) {
            <p class="m-0 text-[13px] text-overdue" role="alert">{{ error() }}</p>
          }

          <div class="flex justify-end gap-2">
            <button type="button" class="btn" (click)="closeDraft()">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">
              {{ saving() ? 'Saving…' : form.id ? 'Save changes' : 'Create action' }}
            </button>
          </div>
        </form>
      </lime-modal>
    }

    @if (confirmDelete(); as action) {
      <lime-modal
        title="Delete this action?"
        [subtitle]="action.technology + ' ' + action.cycle"
        (dismiss)="confirmDelete.set(null)"
      >
        <p class="m-0 mb-4 text-[14px] text-ink-soft">
          The deadline stays; only the plan for it is removed.
        </p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" (click)="confirmDelete.set(null)">Cancel</button>
          <button type="button" class="btn btn-danger" (click)="remove(action)">Delete</button>
        </div>
      </lime-modal>
    }
  `,
})
export class Actions {
  protected readonly api = inject(Api);
  private readonly store = inject(RegistryStore);
  private readonly router = inject(Router);

  /**
   * Bound from ?technology= and ?cycle=, so "Plan upgrade" on the Overview
   * opens this form already filled in.
   */
  readonly technology = input<string>('');
  readonly cycle = input<string>('');

  constructor() {
    effect(() => {
      const technology = this.technology();
      const cycle = this.cycle();

      if (!technology || !cycle) {
        return;
      }

      // Read and write the draft untracked. As a dependency, this effect
      // reopened the form the moment it was closed.
      untracked(() => {
        if (this.draft()) {
          return;
        }

        const match = this.store
          .cycles()
          .find((c) => c.technology === technology && c.cycle === cycle);

        this.draft.set({
          ...blank(),
          technology,
          technologyCycleId: match?.id ?? '',
        });
      });
    });
  }

  protected readonly statuses = STATUSES;
  protected readonly comms = COMMS;
  protected readonly filters = ['ALL', 'OPEN', 'OVERDUE', 'COMPLETED'] as const;

  protected readonly query = signal('');
  protected readonly filter = signal<(typeof this.filters)[number]>('ALL');
  protected readonly draft = signal<Draft | null>(null);
  protected readonly confirmDelete = signal<ApiUpgradeAction | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly technologies = this.store.technologies;
  protected readonly engineers = this.store.engineers;
  protected readonly deployments = this.store.deployments;

  protected readonly open = computed(() =>
    this.api.actions().filter((a) => a.derivedStatus !== 'COMPLETED'),
  );
  protected readonly overdue = computed(() =>
    this.api.actions().filter((a) => a.derivedStatus === 'OVERDUE'),
  );
  protected readonly done = computed(() =>
    this.api.actions().filter((a) => a.derivedStatus === 'COMPLETED'),
  );
  protected readonly unverified = computed(() =>
    this.api.actions().filter((a) => a.unverifiedCompletion),
  );

  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const filter = this.filter();

    return this.api.actions().filter((action) => {
      const matches =
        !needle ||
        `${action.technology} ${action.cycle} ${action.jiraKey ?? ''} ${action.assignee?.name ?? ''}`
          .toLowerCase()
          .includes(needle);

      if (!matches) {
        return false;
      }

      switch (filter) {
        case 'OPEN':
          return action.derivedStatus !== 'COMPLETED';
        case 'OVERDUE':
          return action.derivedStatus === 'OVERDUE';
        case 'COMPLETED':
          return action.derivedStatus === 'COMPLETED';
        default:
          return true;
      }
    });
  });

  protected cyclesFor(technology: string) {
    return this.store.cycles().filter((c) => c.technology === technology);
  }

  protected create(): void {
    this.error.set(null);
    this.draft.set(blank());
  }

  protected edit(action: ApiUpgradeAction): void {
    this.error.set(null);
    this.draft.set({
      id: action.id,
      technology: action.technology,
      technologyCycleId: action.technologyCycleId,
      targetVersion: action.targetVersion ?? '',
      status: action.status,
      plannedDate: action.plannedDate ?? '',
      assigneeId: action.assignee?.id ?? '',
      jiraKey: action.jiraKey ?? '',
      customerComm: action.customerComm,
      customerCommNotes: action.customerCommNotes ?? '',
      remarks: action.remarks ?? '',
      deploymentIds: action.environments.map((e) => e.deploymentId),
    });
  }

  protected onTechnology(): void {
    const form = this.draft();
    if (form) {
      form.technologyCycleId = '';
    }
  }

  protected toggleDeployment(id: string): void {
    const form = this.draft();
    if (!form) {
      return;
    }
    form.deploymentIds = form.deploymentIds.includes(id)
      ? form.deploymentIds.filter((d) => d !== id)
      : [...form.deploymentIds, id];
  }

  protected save(event: Event): void {
    event.preventDefault();
    const form = this.draft();
    if (!form) {
      return;
    }

    if (!form.technologyCycleId) {
      this.error.set('Pick the technology and the cycle that is running out.');
      return;
    }
    if (form.deploymentIds.length === 0) {
      this.error.set('Choose at least one environment this affects.');
      return;
    }

    const body = {
      technologyCycleId: form.technologyCycleId,
      targetVersion: form.targetVersion || undefined,
      deploymentIds: form.deploymentIds,
      assigneeId: form.assigneeId || undefined,
      plannedDate: form.plannedDate || undefined,
      status: form.status,
      jiraKey: form.jiraKey || undefined,
      customerComm: form.customerComm,
      customerCommNotes: form.customerCommNotes || undefined,
      remarks: form.remarks || undefined,
    };

    this.saving.set(true);

    const request = form.id
      ? this.api.updateAction(form.id, body)
      : this.api.createAction(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.api.actionsResource.reload();
        this.closeDraft();
      },
      error: (err: { error?: { message?: string | string[] } }) => {
        this.saving.set(false);
        const message = err.error?.message;
        this.error.set(
          Array.isArray(message)
            ? message.join('. ')
            : (message ?? 'Could not save that.'),
        );
      },
    });
  }

  protected completeEnvironment(action: ApiUpgradeAction, deploymentId: string): void {
    this.api.completeActionEnvironment(action.id, deploymentId).subscribe({
      next: () => this.api.actionsResource.reload(),
    });
  }

  protected remove(action: ApiUpgradeAction): void {
    this.api.deleteAction(action.id).subscribe({
      next: () => {
        this.api.actionsResource.reload();
        this.confirmDelete.set(null);
      },
    });
  }

  /**
   * Closes the form and drops the query params that opened it, so returning to
   * the same cycle from the Overview opens it again.
   */
  protected closeDraft(): void {
    this.draft.set(null);
    this.error.set(null);

    if (this.technology() || this.cycle()) {
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  protected statusColour(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'var(--color-good)';
      case 'OVERDUE':
        return 'var(--color-overdue)';
      case 'IN_PROGRESS':
        return 'var(--color-accent-bright)';
      case 'DEFERRED':
        return 'var(--color-ink-faint)';
      default:
        return 'var(--color-soon)';
    }
  }

  protected commLabel(key: string): string {
    return COMMS.find((c) => c.key === key)?.label ?? key;
  }

  protected statusOf(days: number | null): SupportStatus {
    if (days === null) {
      return 'UNKNOWN';
    }
    if (days <= 0) {
      return 'EOL';
    }
    return days <= 180 ? 'NEAR' : 'SUPPORTED';
  }

  protected date = formatDate;
  protected days = formatDays;
  protected fill = statusFill;
}

function blank(): Draft {
  return {
    technology: '',
    technologyCycleId: '',
    targetVersion: '',
    status: 'PLANNED',
    plannedDate: '',
    assigneeId: '',
    jiraKey: '',
    customerComm: 'NOT_REQUIRED',
    customerCommNotes: '',
    remarks: '',
    deploymentIds: [],
  };
}
