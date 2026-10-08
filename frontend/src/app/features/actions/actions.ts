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
import { Api, ApiUpgradeAction, Decision } from '../../core/api';
import { DECISIONS } from '../../core/process';
import { Permission } from '../../core/permissions';
import { SessionStore } from '../../core/session';
import { formatDate, formatDays, statusFill, SupportStatus } from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';
import { Modal } from '../../shared/modal';
import { PlanBoard } from '../../shared/plan-board';
import { PlanCard } from '../../shared/plan-card';
import { PlanDetail } from '../../shared/plan-detail';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';

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
  decision: Decision | '';
  assessment: string;
  riskApprover: string;
  riskExpiresAt: string;
  customerComm: ApiUpgradeAction['customerComm'];
  customerNotifiedAt: string;
  customerCommNotes: string;
}

@Component({
  selector: 'lime-actions',
  imports: [HlmAlertImports, HlmCardImports, HlmButton, HlmInput, HlmLabel, FormsModule, Modal, PlanCard, PlanBoard, PlanDetail],
  host: { class: 'block' },
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-3xl font-semibold tracking-tight">Upgrade actions</h1>
        <p class="m-0 mt-1 text-sm text-muted-foreground">
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
      @if (session.can('estate:write')) {
        <button type="button" hlmBtn (click)="create()">New action</button>
      }
    </header>

    @if (api.actionsResource.error()) {
      <p hlmAlert variant="destructive" class="mb-5">
        Could not load upgrade actions from the API.
      </p>
    }

    <section hlmCard class="mb-5 flex flex-wrap items-center gap-3 px-6 py-4">
      <input
        type="search"
        [(ngModel)]="query"
        placeholder="Search technology, ticket or assignee"
        aria-label="Search actions"
        hlmInput class="min-w-[240px] flex-1"
      />
      <div class="segmented flex-wrap">
        @for (f of filters; track f) {
          <button
            type="button"
            class="px-3.5 py-1 text-[13px] capitalize"
            [class.bg-background]="filter() === f" [class.shadow-sm]="filter() === f"
            [class.text-foreground]="filter() === f"
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
          class="glass rounded-md border border-rule px-3 py-1 text-[12px] capitalize"
          [class.bg-ink]="view() === mode"
          [style.color]="view() === mode ? 'var(--primary)' : null"
          [style.border-color]="view() === mode ? 'var(--primary)' : null"
          (click)="view.set(mode)"
        >
          {{ mode }}
        </button>
      }
    </div>

    @if (filtered().length === 0) {
      <p hlmCard class="block px-6 py-10 text-center text-[14px] text-ink-soft">
        @if (api.actionsResource.isLoading()) {
          Loading…
        } @else {
          No action matches.
          <button type="button" class="text-primary" (click)="create()">Create one</button>.
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
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Technology
              <select
                hlmInput
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
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Cycle running out
              <select hlmInput [(ngModel)]="form.technologyCycleId" name="cycle">
                <option value="">Choose…</option>
                @for (c of cyclesFor(form.technology); track c.id) {
                  <option [value]="c.id">{{ c.cycle }} — ends {{ date(c.eolDate) }}</option>
                }
              </select>
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Target version
              <select hlmInput class="tabular" [(ngModel)]="form.targetVersion" name="target">
                <option value="">Choose…</option>
                @for (t of targetsFor(form.technology, form.technologyCycleId); track t.value) {
                  <option [value]="t.value">{{ t.label }}</option>
                }
              </select>
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Status
              <select hlmInput [(ngModel)]="form.status" name="status">
                @for (s of statuses; track s) {
                  <option [value]="s">{{ s.toLowerCase().replace('_', ' ') }}</option>
                }
              </select>
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Planned date
              <input type="date" hlmInput [(ngModel)]="form.plannedDate" name="planned" />
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Assignee
              <select hlmInput [(ngModel)]="form.assigneeId" name="assignee">
                <option value="">Unassigned</option>
                @for (e of engineers(); track e.id) {
                  <option [value]="e.id">{{ e.name }}</option>
                }
              </select>
            </label>
          </div>

          <fieldset class="m-0 grid gap-3 rounded-lg border p-4">
            <legend class="px-1 text-sm font-medium">Process</legend>
            <div class="grid gap-3 sm:grid-cols-2">
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Decision
                <select hlmInput [(ngModel)]="form.decision" name="decision">
                  <option value="">Not decided yet</option>
                  @for (d of decisions; track d.key) {
                    <option [value]="d.key">{{ d.label }} — {{ d.hint }}</option>
                  }
                </select>
              </label>
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Customer notice
                <select hlmInput [(ngModel)]="form.customerComm" name="comm">
                  <option value="NOT_REQUIRED">Not required</option>
                  <option value="PENDING">To send</option>
                  <option value="SENT">Sent</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                </select>
              </label>
            </div>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Assessment
              <textarea
                hlmInput
                rows="2"
                class="h-auto py-2"
                [(ngModel)]="form.assessment"
                name="assessment"
                placeholder="Impact, compatibility with Lime, effort"
              ></textarea>
            </label>
            @if (form.decision === 'ACCEPT_RISK') {
              <div class="grid gap-3 sm:grid-cols-2">
                <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                  Risk approved by
                  <input hlmInput [(ngModel)]="form.riskApprover" name="approver" placeholder="Name and role" />
                </label>
                <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                  Acceptance expires
                  <input type="date" hlmInput [(ngModel)]="form.riskExpiresAt" name="expires" />
                </label>
              </div>
            }
            @if (form.customerComm === 'SENT' || form.customerComm === 'ACKNOWLEDGED') {
              <div class="grid gap-3 sm:grid-cols-2">
                <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                  Customer notified on
                  <input type="date" hlmInput [(ngModel)]="form.customerNotifiedAt" name="notified" />
                </label>
                <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                  Notice notes
                  <input hlmInput [(ngModel)]="form.customerCommNotes" name="commnotes" placeholder="Who, which channel" />
                </label>
              </div>
            }
          </fieldset>

          <fieldset class="m-0 border-0 p-0">
            <legend class="mb-2 p-0 text-[12px] text-ink-soft">Environments affected</legend>
            <div class="scroll-hidden flex max-h-[150px] flex-wrap gap-2 overflow-y-auto">
              @for (d of deployments(); track d.id) {
                <button
                  type="button"
                  class="glass rounded-md border px-3 py-1.5 text-[12px]"
                  [class.border-primary]="form.deploymentIds.includes(d.id)"
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
            <button type="button" hlmBtn variant="outline" (click)="closeDraft()">Cancel</button>
            <button type="submit" hlmBtn [disabled]="saving()">
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
          <button type="button" hlmBtn variant="outline" (click)="confirmDelete.set(null)">Cancel</button>
          <button type="button" hlmBtn variant="destructive" (click)="remove(action)">Delete</button>
        </div>
      </lime-modal>
    }
  `,
})
export class Actions {
  protected readonly api = inject(Api);
  protected readonly session = inject(SessionStore);
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
  protected readonly decisions = DECISIONS;
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
      decision: action.decision ?? '',
      assessment: action.assessment ?? '',
      riskApprover: action.riskApprover ?? '',
      riskExpiresAt: action.riskExpiresAt ?? '',
      customerComm: action.customerComm,
      customerNotifiedAt: action.customerNotifiedAt ?? '',
      customerCommNotes: action.customerCommNotes ?? '',
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
      decision: form.decision || null,
      assessment: form.assessment.trim() || null,
      riskApprover: form.decision === 'ACCEPT_RISK' ? form.riskApprover.trim() || null : null,
      riskExpiresAt: form.decision === 'ACCEPT_RISK' ? form.riskExpiresAt || null : null,
      customerComm: form.customerComm,
      customerNotifiedAt: form.customerNotifiedAt || null,
      customerCommNotes: form.customerCommNotes.trim() || null,
    } as Record<string, unknown>;

    if (form.id && !this.session.can('estate:write')) {
      const allowed: [string, Permission][] = [
        ['customerComm', 'plan:notice'],
        ['customerNotifiedAt', 'plan:notice'],
        ['customerCommNotes', 'plan:notice'],
        ['decision', 'plan:decision'],
        ['riskApprover', 'plan:decision'],
        ['riskExpiresAt', 'plan:decision'],
        ['assessment', 'plan:assess'],
      ];
      for (const key of Object.keys(body)) {
        const rule = allowed.find(([field]) => field === key);
        if (!rule || !this.session.can(rule[1])) delete body[key];
      }
    }

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
        return 'var(--primary)';
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
    decision: '',
    assessment: '',
    riskApprover: '',
    riskExpiresAt: '',
    customerComm: 'PENDING',
    customerNotifiedAt: '',
    customerCommNotes: '',
  };
}
