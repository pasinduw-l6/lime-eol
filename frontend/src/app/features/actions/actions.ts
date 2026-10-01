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
import { PlanBoard } from '../../shared/plan-board';
import { PlanCard } from '../../shared/plan-card';
import { PlanDetail } from '../../shared/plan-detail';

const STATUSES = ['NOT_STARTED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED'];

interface Draft {
  id?: string;
  technology: string;
  technologyCycleId: string;
  targetVersion: string;
  status: string;
  plannedDate: string;
  assigneeId: string;
  deploymentIds: string[];
}

@Component({
  selector: 'lime-actions',
  imports: [FormsModule, Modal, PlanCard, PlanBoard, PlanDetail],
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

    <div class="mb-3 flex items-center gap-1">
      @for (mode of views; track mode) {
        <button
          type="button"
          class="glass rounded-full border border-rule px-3 py-1 text-[12px] capitalize"
          [class.bg-ink]="view() === mode"
          [style.color]="view() === mode ? 'var(--color-accent-bright)' : null"
          [style.border-color]="view() === mode ? 'var(--color-accent-bright)' : null"
          (click)="view.set(mode)"
        >
          {{ mode }}
        </button>
      }
    </div>

    @if (filtered().length === 0) {
      <p class="card px-7 py-10 text-center text-[14px] text-ink-soft">
        @if (api.actionsResource.isLoading()) {
          Loading…
        } @else {
          No action matches.
          <button type="button" class="text-accent-bright" (click)="create()">Create one</button>.
        }
      </p>
    } @else if (view() === 'board') {
      <lime-plan-board [actions]="filtered()" (open)="detail.set($event)" />
    } @else {
      <div class="grid gap-4">
        @for (action of filtered(); track action.id) {
          <lime-plan-card
            [action]="action"
            (editing)="edit(action)"
            (removing)="confirmDelete.set(action)"
            (complete)="completeEnvironment(action, $event)"
          />
        }
      </div>
    }

    @if (detail(); as open) {
      <lime-plan-detail [action]="open" (close)="detail.set(null)" />
    }

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
              <select class="input tabular" [(ngModel)]="form.targetVersion" name="target">
                <option value="">Choose…</option>
                @for (t of targetsFor(form.technology, form.technologyCycleId); track t.value) {
                  <option [value]="t.value">{{ t.label }}</option>
                }
              </select>
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

  readonly technology = input<string>('');
  readonly cycle = input<string>('');

  constructor() {
    effect(() => {
      const technology = this.technology();
      const cycle = this.cycle();

      if (!technology || !cycle) {
        return;
      }

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
  protected readonly filters = ['ALL', 'OPEN', 'OVERDUE', 'COMPLETED'] as const;

  protected readonly query = signal('');
  protected readonly filter = signal<(typeof this.filters)[number]>('ALL');
  protected readonly draft = signal<Draft | null>(null);
  protected readonly confirmDelete = signal<ApiUpgradeAction | null>(null);
  protected readonly detail = signal<ApiUpgradeAction | null>(null);

  protected readonly views = ['board', 'list'] as const;
  protected readonly view = signal<(typeof this.views)[number]>('board');
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

  protected targetsFor(
    technology: string,
    excludeCycleId: string,
  ): { value: string; label: string }[] {
    const today = new Date().toISOString().slice(0, 10);

    return this.cyclesFor(technology)
      .filter((cycle) => cycle.id !== excludeCycleId)
      .sort((a, b) => (b.eolDate ?? '').localeCompare(a.eolDate ?? ''))
      .map((cycle) => {
        const version = cycle.latestPatch ?? cycle.cycle;
        const state = !cycle.eolDate
          ? 'no date recorded'
          : cycle.eolDate < today
            ? `past end of life ${this.date(cycle.eolDate)}`
            : `supported until ${this.date(cycle.eolDate)}`;

        return {
          value: version,
          label: `${version} · ${state}`,
        };
      });
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
    deploymentIds: [],
  };
}
