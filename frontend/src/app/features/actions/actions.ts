import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatDate, formatDays, parseDate, statusFill, today } from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';
import { UpgradeAction } from '../../core/models';
import { Modal } from '../../shared/modal';

type Status = UpgradeAction['status'];

const STATUSES: Status[] = [
  'NOT_STARTED',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'DEFERRED',
];

function blank(): Omit<UpgradeAction, 'id'> & { id?: string } {
  return {
    technology: '',
    cycle: '',
    targetVersion: '',
    status: 'PLANNED',
    plannedDate: null,
    completedDate: null,
    assignee: null,
    team: null,
    jiraKey: null,
    deploymentIds: [],
  };
}

/**
 * Upgrade actions.
 *
 * The work half of the tool: deadlines are facts, actions are what the team
 * does about them. Create, edit, complete and delete, with the same
 * completed-date rule the database enforces.
 */
@Component({
  selector: 'lime-actions',
  imports: [FormsModule, Modal],
  host: { class: 'block' },
  template: `
    <section class="card mb-5 flex flex-wrap items-start justify-between gap-4 px-7 py-6">
      <div>
        <h1 class="m-0 text-[30px] font-semibold tracking-[-0.02em]">Upgrade actions</h1>
        <p class="m-0 text-[14px] text-ink-soft">
          {{ open().length }} open · {{ overdue().length }} overdue ·
          {{ done().length }} completed
        </p>
      </div>
      <button type="button" class="btn btn-primary" (click)="create()">New action</button>
    </section>

    <section class="card mb-5 flex flex-wrap items-center gap-3 px-7 py-4">
      <input
        type="search"
        [(ngModel)]="query"
        placeholder="Search technology, Jira key or assignee"
        aria-label="Search actions"
        class="min-w-[240px] flex-1 rounded-full border border-rule bg-elevated px-4 py-2 text-[14px] text-ink"
      />
      <div class="flex flex-wrap gap-1 rounded-full border border-rule bg-elevated p-1">
        @for (f of filters; track f) {
          <button
            type="button"
            class="rounded-full px-3.5 py-1.5 text-[13px] capitalize"
            [class.bg-ink]="filter() === f"
            [class.text-ground]="filter() === f"
            [class.text-ink-soft]="filter() !== f"
            (click)="filter.set(f)"
          >
            {{ f.toLowerCase().replace('_', ' ') }}
          </button>
        }
      </div>
    </section>

    <section class="card overflow-hidden">
      <table class="w-full border-collapse text-[14px]">
        <caption class="sr-only">Upgrade actions</caption>
        <thead>
          <tr class="border-b border-rule text-left text-[12px] text-ink-soft">
            <th class="px-6 py-3 font-medium">What</th>
            <th class="px-3 py-3 font-medium">Status</th>
            <th class="px-3 py-3 font-medium">Planned</th>
            <th class="px-3 py-3 font-medium">Owner</th>
            <th class="px-3 py-3 font-medium">Environments</th>
            <th class="px-6 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (row of filtered(); track row.action.id) {
            <tr class="border-b border-rule last:border-b-0">
              <td class="px-6 py-3">
                <span class="block font-medium">
                  {{ row.action.technology }} {{ row.action.cycle }}
                  <span class="text-ink-soft">→ {{ row.action.targetVersion }}</span>
                </span>
                <span class="tabular block text-[12px] text-ink-soft">
                  {{ row.action.jiraKey || 'no ticket' }}
                  @if (row.deadline) {
                    · support ends {{ row.deadline }}
                  }
                </span>
              </td>
              <td class="px-3 py-3">
                <span
                  class="rounded-full border px-2.5 py-0.5 text-[12px] capitalize"
                  [style.border-color]="row.colour"
                  [style.color]="row.colour"
                >
                  {{ row.action.status.toLowerCase().replace('_', ' ') }}
                </span>
              </td>
              <td class="tabular px-3 py-3" [class.text-overdue]="row.isOverdue">
                {{ date(row.action.plannedDate) }}
                @if (row.isOverdue) {
                  <span class="block text-[11px]">overdue</span>
                }
              </td>
              <td class="px-3 py-3 text-ink-soft">{{ row.action.assignee || '—' }}</td>
              <td class="tabular px-3 py-3 text-ink-soft">
                {{ row.action.deploymentIds.length }}
              </td>
              <td class="px-6 py-3">
                <span class="flex justify-end gap-2">
                  @if (row.action.status !== 'COMPLETED') {
                    <button type="button" class="text-[12px] text-good" (click)="complete(row.action)">
                      Complete
                    </button>
                  }
                  <button type="button" class="text-[12px] text-accent-bright" (click)="edit(row.action)">
                    Edit
                  </button>
                  <button type="button" class="text-[12px] text-overdue" (click)="confirmDelete.set(row.action)">
                    Delete
                  </button>
                </span>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="px-6 py-8 text-center text-ink-soft">
                No action matches. <button type="button" class="text-accent-bright" (click)="create()">Create one</button>.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </section>

    <!-- create / edit -->
    @if (draft(); as form) {
      <lime-modal
        [title]="form.id ? 'Edit action' : 'New upgrade action'"
        subtitle="Plan the work against a cycle that is running out of support."
        (dismiss)="draft.set(null)"
      >
        <form class="grid gap-4" (submit)="save($event)">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="field">
              Technology
              <select class="input" [(ngModel)]="form.technology" name="technology" (change)="onTechnology()">
                <option value="">Choose…</option>
                @for (t of technologies(); track t.id) {
                  <option [value]="t.name">{{ t.name }}</option>
                }
              </select>
            </label>
            <label class="field">
              Cycle running out
              <select class="input" [(ngModel)]="form.cycle" name="cycle">
                <option value="">Choose…</option>
                @for (c of cyclesFor(form.technology); track c.id) {
                  <option [value]="c.cycle">{{ c.cycle }} — ends {{ date(c.eolDate) }}</option>
                }
              </select>
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <label class="field">
              Target version
              <input class="input" [(ngModel)]="form.targetVersion" name="target" placeholder="4.1" />
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

          @if (form.status === 'COMPLETED') {
            <label class="field">
              Completed date
              <input type="date" class="input" [(ngModel)]="form.completedDate" name="completed" />
            </label>
          }

          <div class="grid gap-3 sm:grid-cols-3">
            <label class="field">
              Assignee
              <select class="input" [(ngModel)]="form.assignee" name="assignee">
                <option [ngValue]="null">Unassigned</option>
                @for (e of engineers(); track e.id) {
                  <option [ngValue]="e.name">{{ e.name }}</option>
                }
              </select>
            </label>
            <label class="field">
              Team
              <input class="input" [(ngModel)]="form.team" name="team" placeholder="DevOps" />
            </label>
            <label class="field">
              Jira key
              <input class="input tabular" [(ngModel)]="form.jiraKey" name="jira" placeholder="LIME-1042" />
            </label>
          </div>

          <fieldset class="m-0 border-0 p-0">
            <legend class="mb-2 p-0 text-[12px] text-ink-soft">Environments affected</legend>
            <div class="flex max-h-[150px] flex-wrap gap-2 overflow-y-auto">
              @for (d of deployments(); track d.id) {
                <button
                  type="button"
                  class="rounded-full border px-3 py-1.5 text-[12px]"
                  [class.border-accent]="form.deploymentIds.includes(d.id)"
                  [class.bg-elevated]="form.deploymentIds.includes(d.id)"
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
            <button type="button" class="btn" (click)="draft.set(null)">Cancel</button>
            <button type="submit" class="btn btn-primary">
              {{ form.id ? 'Save changes' : 'Create action' }}
            </button>
          </div>
        </form>
      </lime-modal>
    }

    <!-- delete -->
    @if (confirmDelete(); as action) {
      <lime-modal
        title="Delete this action?"
        [subtitle]="action.technology + ' ' + action.cycle + ' → ' + action.targetVersion"
        (dismiss)="confirmDelete.set(null)"
      >
        <p class="m-0 mb-5 text-[14px] text-ink-soft">
          The deadline stays; only the plan against it is removed. This cannot be
          undone.
        </p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" (click)="confirmDelete.set(null)">Keep it</button>
          <button type="button" class="btn btn-danger" (click)="remove(action)">Delete action</button>
        </div>
      </lime-modal>
    }
  `,
})
export class Actions {
  private readonly store = inject(RegistryStore);

  /**
   * Bound from ?technology= and ?cycle=, so "Plan upgrade" on the Overview
   * opens this form already filled in rather than dropping you on a list to
   * find the thing you just clicked.
   */
  readonly technology = input<string>('');
  readonly cycle = input<string>('');

  constructor() {
    effect(() => {
      const technology = this.technology();
      const cycle = this.cycle();

      if (technology && cycle && !this.draft()) {
        this.draft.set({ ...blank(), technology, cycle });
      }
    });
  }

  protected readonly statuses = STATUSES;
  protected readonly filters = ['ALL', 'OPEN', 'OVERDUE', 'COMPLETED'] as const;

  protected readonly query = signal('');
  protected readonly filter = signal<(typeof this.filters)[number]>('ALL');
  protected readonly draft = signal<(Omit<UpgradeAction, 'id'> & { id?: string }) | null>(null);
  protected readonly confirmDelete = signal<UpgradeAction | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly technologies = this.store.technologies;
  protected readonly engineers = this.store.engineers;
  protected readonly deployments = this.store.deployments;

  private readonly rows = computed(() =>
    this.store.actions().map((action) => {
      const planned = parseDate(action.plannedDate);
      const isOverdue =
        action.status !== 'COMPLETED' &&
        action.status !== 'DEFERRED' &&
        planned !== null &&
        planned.getTime() < today().getTime();

      const cycle = this.store
        .cycles()
        .find((c) => c.technology === action.technology && c.cycle === action.cycle);

      return {
        action,
        isOverdue,
        deadline: cycle ? formatDate(cycle.eolDate) : null,
        colour: isOverdue
          ? 'var(--color-overdue)'
          : action.status === 'COMPLETED'
            ? 'var(--color-good)'
            : 'var(--color-accent-bright)',
      };
    }),
  );

  protected readonly open = computed(() =>
    this.rows().filter((r) => r.action.status !== 'COMPLETED'),
  );
  protected readonly overdue = computed(() => this.rows().filter((r) => r.isOverdue));
  protected readonly done = computed(() =>
    this.rows().filter((r) => r.action.status === 'COMPLETED'),
  );

  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const filter = this.filter();

    return this.rows()
      .filter((r) => {
        if (filter === 'OPEN') return r.action.status !== 'COMPLETED';
        if (filter === 'OVERDUE') return r.isOverdue;
        if (filter === 'COMPLETED') return r.action.status === 'COMPLETED';
        return true;
      })
      .filter(
        (r) =>
          !needle ||
          `${r.action.technology} ${r.action.cycle} ${r.action.jiraKey ?? ''} ${r.action.assignee ?? ''}`
            .toLowerCase()
            .includes(needle),
      )
      .sort(
        (a, b) =>
          Number(b.isOverdue) - Number(a.isOverdue) ||
          (a.action.plannedDate ?? '9999').localeCompare(b.action.plannedDate ?? '9999'),
      );
  });

  protected cyclesFor(technology: string) {
    return this.store
      .cycles()
      .filter((c) => c.technology === technology)
      .sort((a, b) => (a.eolDate ?? '9999').localeCompare(b.eolDate ?? '9999'));
  }

  protected create(): void {
    this.error.set(null);
    this.draft.set(blank());
  }

  protected edit(action: UpgradeAction): void {
    this.error.set(null);
    this.draft.set({ ...action });
  }

  protected onTechnology(): void {
    const form = this.draft();
    if (form) {
      form.cycle = '';
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

    if (!form.technology || !form.cycle) {
      this.error.set('Pick the technology and the cycle that is running out.');
      return;
    }
    // Mirrors the database check: completed work must say when it completed.
    if (form.status === 'COMPLETED' && !form.completedDate) {
      this.error.set('A completed action needs a completion date.');
      return;
    }
    if (form.status !== 'COMPLETED') {
      form.completedDate = null;
    }

    this.store.saveAction(form);
    this.draft.set(null);
    this.error.set(null);
  }

  protected complete(action: UpgradeAction): void {
    this.store.completeAction(action.id, new Date().toISOString().slice(0, 10));
  }

  protected remove(action: UpgradeAction): void {
    this.store.deleteAction(action.id);
    this.confirmDelete.set(null);
  }

  protected date = formatDate;
  protected days = formatDays;
  protected fill = statusFill;
}
