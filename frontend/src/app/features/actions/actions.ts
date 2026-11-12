import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, ApiJiraAssignee, ApiJiraSubtask, ApiUpgradeAction, Decision } from '../../core/api';
import { DECISIONS } from '../../core/process';
import { Permission } from '../../core/permissions';
import { SessionStore } from '../../core/session';
import { formatDate, formatDays, statusFill, SupportStatus } from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';
import { Feedback } from '../../core/feedback';
import {
  Gantt,
  GanttGroup,
  GanttItem,
  GanttMenu,
  GanttSub,
  GanttZoom,
  shiftDays,
  todayIso,
} from '../../shared/gantt';
import { SubtaskDialogs } from './subtask-dialogs';
import { SearchOption, SearchSelect } from '../../shared/search-select';
import { map, Observable, of, tap } from 'rxjs';
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
  startDate: string;
  plannedDate: string;
  jiraAssigneeId: string;
  jiraAssigneeName: string;
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
  imports: [HlmAlertImports, HlmCardImports, HlmButton, HlmInput, HlmLabel, FormsModule, Gantt, Modal, SearchSelect, SubtaskDialogs, PlanCard, PlanBoard, PlanDetail],
  host: { class: 'block' },
  template: `
    <header class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-3xl font-semibold tracking-tight">
          Upgrade plans
          @if (activeProject(); as project) {
            <span class="text-muted-foreground font-normal">· {{ project.customer }} {{ project.name }}</span>
          }
        </h1>
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
      <div class="segmented" role="tablist" aria-label="View">
        @for (mode of views; track mode) {
          <button
            type="button"
            role="tab"
            class="px-3.5 py-1 text-[13px] capitalize"
            [attr.aria-selected]="view() === mode"
            [class.bg-background]="view() === mode" [class.shadow-sm]="view() === mode"
            [class.text-foreground]="view() === mode"
            [class.text-ink-soft]="view() !== mode"
            (click)="view.set(mode)"
          >
            {{ mode }}
          </button>
        }
      </div>
    </header>

    @if (api.actionsResource.error()) {
      <p hlmAlert variant="destructive" class="mb-5">
        Could not load upgrade plans from the API.
      </p>
    }

    <section class="mb-3 flex flex-wrap items-center gap-2">
      @if (view() === 'timeline') {
        <button type="button" hlmBtn variant="outline" size="sm" (click)="goToday()">Today</button>
        <select hlmInput class="h-8 w-auto py-0 text-[13px]" aria-label="Zoom" [ngModel]="zoom()" (ngModelChange)="zoom.set($event)">
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
        </select>
        <button type="button" hlmBtn variant="ghost" size="sm" aria-label="Previous" (click)="shift(-1)">‹</button>
        <button type="button" hlmBtn variant="ghost" size="sm" aria-label="Next" (click)="shift(1)">›</button>
        <span class="mr-2 text-[15px] font-semibold">{{ period() }}</span>
      }
      <input
        type="search"
        [(ngModel)]="query"
        placeholder="Search technology, ticket or assignee"
        aria-label="Search plans"
        hlmInput class="h-8 min-w-[200px] flex-1 text-[13px]"
      />
      @if (!activeProject()) {
        <lime-search-select
          class="w-[180px]"
          [value]="customer()"
          (valueChange)="customer.set($event)"
          [options]="customerOptions()"
          emptyLabel="All customers"
          [compact]="true"
          label="Customer"
        />
      }
      <select hlmInput class="h-8 w-auto py-0 text-[13px]" aria-label="Status" [ngModel]="filter()" (ngModelChange)="filter.set($event)">
        @for (f of filters; track f) {
          <option [value]="f">{{ f === 'ALL' ? 'All statuses' : f.charAt(0) + f.slice(1).toLowerCase() }}</option>
        }
      </select>
      @if (canEditPlans()) {
        <button type="button" hlmBtn size="sm" class="ml-auto" (click)="create()">+ New plan</button>
      }
    </section>

    @if (view() === 'timeline' && filtered().length > 0) {
      <lime-gantt
        [groups]="ganttGroups()"
        [zoom]="zoom()"
        [anchor]="anchor()"
        [editable]="canEditPlans()"
        (zoomChange)="zoom.set($event)"
        (scrollDays)="scrollBy($event)"
        (menu)="onMenu($event)"
        (subMenu)="dialogs.onSub($event)"
        (jira)="dialogs.onJira($event)"
      />
      <lime-subtask-dialogs #dialogs />
      <p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        <span class="flex items-center gap-1.5"><span class="size-2 rotate-45" style="background: var(--color-overdue)"></span>End of life</span>
        <span class="flex items-center gap-1.5"><span class="size-2 rotate-45" style="background: var(--color-soon)"></span>Risk acceptance expires</span>
        <span class="flex items-center gap-1.5"><span class="h-2.5 w-4 rounded-sm" style="box-shadow: 0 0 0 1.5px var(--color-overdue)"></span>Finishes after end of life</span>
        <span>Drag the chart or use Shift + wheel to move through time · change dates from ⋯ → Edit</span>
      </p>
    } @else if (filtered().length === 0) {
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
              <lime-search-select
                [(value)]="form.technology"
                (picked)="onTechnology()"
                [options]="technologyOptions()"
                label="Technology"
              />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Cycle running out
              <lime-search-select
                [(value)]="form.technologyCycleId"
                (picked)="onCycle()"
                [options]="cycleOptions(form.technology)"
                [disabled]="!form.technology"
                label="Cycle running out"
              />
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Target version
              <input
                hlmInput
                class="tabular"
                [(ngModel)]="form.targetVersion"
                name="target"
                list="target-versions"
                autocomplete="off"
                placeholder="Choose or type a version"
              />
              <datalist id="target-versions">
                @for (t of targetsFor(form.technology, form.technologyCycleId); track t.value) {
                  <option [value]="t.value">{{ t.label }}</option>
                }
              </datalist>
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Status
              <select hlmInput [(ngModel)]="form.status" name="status">
                @for (s of statuses; track s) {
                  <option [value]="s">{{ s.toLowerCase().replace('_', ' ') }}</option>
                }
              </select>
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Start date
              <input type="date" hlmInput [(ngModel)]="form.startDate" name="start" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Due date
              <input type="date" hlmInput [(ngModel)]="form.plannedDate" name="planned" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Assignee (Jira)
              <lime-search-select
                [(value)]="form.jiraAssigneeId"
                (picked)="form.jiraAssigneeName = $event?.label ?? ''"
                [remote]="jiraPeople"
                [selectedLabel]="form.jiraAssigneeName || null"
                emptyLabel="Unassigned"
                [disabled]="!form.id && !planProject(form)"
                emptyText="Nobody on this Jira board matches"
                label="Assignee in Jira"
              />
              @if (!form.id && !planProject(form)) {
                <span class="text-[11.5px] text-muted-foreground">Tick an environment below first.</span>
              } @else if (jiraConnected() === false) {
                <span class="text-[11.5px] text-muted-foreground">No Jira board for this project. Connect one in Operations.</span>
              }
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

  protected readonly views = ['timeline', 'list', 'board'] as const;
  protected readonly view = signal<(typeof this.views)[number]>('timeline');
  protected readonly zoom = signal<GanttZoom>('month');
  protected readonly anchor = signal(todayIso());
  protected readonly customer = signal('');
  private readonly feedback = inject(Feedback);
  private readonly gantt = viewChild(Gantt);

  protected readonly period = computed(() => {
    const date = new Date(`${this.anchor()}T00:00:00Z`);
    const month = date.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
    const year = date.getUTCFullYear();
    switch (this.zoom()) {
      case 'week':
        return `${date.getUTCDate()} ${month} ${year}`;
      case 'quarter':
        return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${year}`;
      default:
        return `${month} ${year}`;
    }
  });

  private readonly projectIndex = computed(
    () => new Map(this.api.projects().map((p) => [p.id, p])),
  );

  protected readonly customers = computed(() =>
    [...new Set(this.api.projects().map((p) => p.customer))].sort((a, b) => a.localeCompare(b)),
  );

  protected readonly ganttGroups = computed<GanttGroup[]>(() => {
    const projects = this.projectIndex();
    const groups = new Map<string, GanttGroup>();
    const customer = this.customer();
    const active = this.activeProject();

    for (const action of this.filtered()) {
      const ids = [...new Set(action.environments.map((e) => e.projectId ?? ''))];
      for (const id of ids.length ? ids : ['']) {
        const project = projects.get(id);
        if (active && id !== active.id) continue;
        if (!active && customer && project?.customer !== customer) continue;
        const key = id || 'unassigned';
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            title: project?.customer ?? 'No project',
            subtitle: project?.name ?? 'Environments not linked',
            items: [],
          });
        }
        groups.get(key)!.items.push(toItem(action));
      }
    }

    return [...groups.values()]
      .map((g) => ({ ...g, items: g.items.sort((a, b) => a.start.localeCompare(b.start)) }))
      .sort((a, b) => `${a.title} ${a.subtitle}`.localeCompare(`${b.title} ${b.subtitle}`));
  });

  protected shift(direction: number): void {
    const step = { week: 7, month: 28, quarter: 91 }[this.zoom()];
    this.anchor.set(shiftDays(this.anchor(), step * direction));
  }

  protected goToday(): void {
    this.anchor.set(todayIso());
    setTimeout(() => this.gantt()?.scrollToToday());
  }

  protected scrollBy(days: number): void {
    this.anchor.set(shiftDays(this.anchor(), days));
  }

  protected onMenu(event: GanttMenu): void {
    const action = this.api.actions().find((a) => a.id === event.id);
    if (!action) return;

    switch (event.action) {
      case 'open':
        this.detail.set(action);
        break;
      case 'edit':
        this.edit(action);
        break;
      case 'delete':
        this.confirmDelete.set(action);
        break;
      case 'complete':
        this.api
          .updateAction(action.id, { status: 'COMPLETED', completedDate: todayIso() })
          .subscribe({
            next: () => {
              this.api.actionsResource.reload();
              this.feedback.success(`${action.technology} ${action.cycle} marked completed.`);
            },
            error: (err) => this.feedback.failed(err, 'Could not update that plan.'),
          });
        break;
    }
  }
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly technologies = this.store.technologies;
  protected readonly engineers = this.store.engineers;
  protected readonly deployments = this.store.deployments;

  protected readonly activeProject = this.store.activeProject;

  protected readonly canEditPlans = computed(
    () => this.session.can('estate:write') && this.api.canEditProject(this.activeProject()?.id),
  );

  protected readonly scoped = computed(() => {
    const project = this.activeProject();
    const all = this.api.actions();
    return project ? all.filter((a) => a.environments.some((e) => e.projectId === project.id)) : all;
  });

  protected readonly open = computed(() =>
    this.scoped().filter((a) => a.derivedStatus !== 'COMPLETED'),
  );
  protected readonly overdue = computed(() =>
    this.scoped().filter((a) => a.derivedStatus === 'OVERDUE'),
  );
  protected readonly done = computed(() =>
    this.scoped().filter((a) => a.derivedStatus === 'COMPLETED'),
  );
  protected readonly unverified = computed(() =>
    this.scoped().filter((a) => a.unverifiedCompletion),
  );

  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const filter = this.filter();

    return this.scoped().filter((action) => {
      const matches =
        !needle ||
        `${action.technology} ${action.cycle} ${action.jiraKey ?? ''} ${action.jiraAssignee ?? ''}`
          .toLowerCase()
          .includes(needle);

      if (!matches) {
        return false;
      }

      const customer = this.activeProject() ? '' : this.customer();
      if (
        customer &&
        !action.environments.some((e) => this.projectIndex().get(e.projectId ?? '')?.customer === customer)
      ) {
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

  protected readonly customerOptions = computed<SearchOption[]>(() =>
    this.customers().map((c) => ({ value: c, label: c })),
  );

  protected readonly technologyOptions = computed<SearchOption[]>(() =>
    this.technologies().map((t) => ({ value: t.name, label: t.name })),
  );

  protected cycleOptions(technology: string): SearchOption[] {
    return this.cyclesFor(technology).map((c) => ({
      value: c.id,
      label: c.cycle,
      hint: c.eolDate ? `ends ${this.date(c.eolDate)}` : 'no end date',
    }));
  }

  /** False once the project is known to have no Jira board; null until asked. */
  protected readonly jiraConnected = signal<boolean | null>(null);

  /** The project whose Jira board the assignee comes from. */
  protected planProject(form: Draft): string | null {
    return (
      this.activeProject()?.id ??
      this.store.allDeployments().find((d) => form.deploymentIds.includes(d.id))?.projectId ??
      null
    );
  }

  /** Searched live in Jira each time; the people are never saved as app users. */
  protected readonly jiraPeople = (query: string): Observable<SearchOption[]> => {
    const form = this.draft();
    if (!form) return of([]);
    const toOptions = (people: ApiJiraAssignee[]) => people.map((p) => ({ value: p.id, label: p.name }));
    if (form.id) return this.api.jiraAssignees(form.id, query).pipe(map(toOptions));
    const projectId = this.planProject(form);
    if (!projectId) return of([]);
    return this.api.projectJiraAssignees(projectId, query).pipe(
      tap((result) => this.jiraConnected.set(result.connected)),
      map((result) => toOptions(result.people)),
    );
  };

  protected targetsFor(
    technology: string,
    excludeCycleId: string,
  ): { value: string; label: string }[] {
    const today = new Date().toISOString().slice(0, 10);
    const users = new Map<string, string[]>();
    for (const d of this.store.allDeployments()) {
      for (const c of d.components) {
        if (c.technology !== technology) continue;
        users.set(c.version, [...(users.get(c.version) ?? []), `${d.customer} ${d.environment}`]);
      }
    }

    return this.cyclesFor(technology)
      .filter((cycle) => cycle.id !== excludeCycleId)
      .sort((a, b) => (b.eolDate ?? '').localeCompare(a.eolDate ?? ''))
      .flatMap((cycle) => {
        const latest = cycle.latestPatch ?? cycle.cycle;
        const state = !cycle.eolDate
          ? 'no date recorded'
          : cycle.eolDate < today
            ? `past end of life ${this.date(cycle.eolDate)}`
            : `supported until ${this.date(cycle.eolDate)}`;

        const recorded = cycle.versions
          .filter((v) => v !== latest && v !== cycle.cycle)
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
          .map((v) => ({
            value: v,
            label: `${v} · ${users.has(v) ? `used by ${users.get(v)!.join(', ')}` : 'recorded'}`,
          }));

        return [{ value: latest, label: `${latest} · ${state}` }, ...recorded];
      });
  }

  /** The cycle this project runs for a technology, and the environments running it. */
  private runningCycle(technology: string): { cycleId: string; deploymentIds: string[] } | null {
    if (!this.activeProject()) return null;
    const cycles = this.cyclesFor(technology);
    const found = this.deployments().flatMap((d) =>
      d.components
        .filter((c) => c.technology === technology)
        .map((c) => ({ deploymentId: d.id, cycle: cycles.find((y) => y.versions.includes(c.version)) }))
        .filter((x) => x.cycle),
    );
    if (found.length === 0) return null;
    const oldest = found
      .map((x) => x.cycle!)
      .sort((a, b) => (a.eolDate ?? '9999').localeCompare(b.eolDate ?? '9999'))[0];
    return {
      cycleId: oldest.id,
      deploymentIds: found.filter((x) => x.cycle!.id === oldest.id).map((x) => x.deploymentId),
    };
  }

  protected create(): void {
    this.error.set(null);
    this.jiraConnected.set(null);
    this.draft.set(blank());
  }

  protected edit(action: ApiUpgradeAction): void {
    this.error.set(null);
    this.jiraConnected.set(null);
    this.draft.set({
      id: action.id,
      technology: action.technology,
      technologyCycleId: action.technologyCycleId,
      targetVersion: action.targetVersion ?? '',
      status: action.status,
      startDate: action.startDate ?? '',
      plannedDate: action.plannedDate ?? '',
      jiraAssigneeId: action.jiraAssigneeId ?? '',
      jiraAssigneeName: action.jiraAssignee ?? '',
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
    if (!form) return;
    form.targetVersion = '';
    const running = this.runningCycle(form.technology);
    form.technologyCycleId = running?.cycleId ?? '';
    if (running && !form.id) form.deploymentIds = running.deploymentIds;
  }

  protected onCycle(): void {
    const form = this.draft();
    if (!form) return;
    form.targetVersion = '';
    if (form.id || !this.activeProject()) return;
    const ids = this.deployments()
      .filter((d) =>
        d.components.some(
          (c) =>
            c.technology === form.technology &&
            this.cyclesFor(form.technology)
              .find((y) => y.id === form.technologyCycleId)
              ?.versions.includes(c.version),
        ),
      )
      .map((d) => d.id);
    if (ids.length) form.deploymentIds = ids;
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
      jiraAssigneeId: form.jiraAssigneeId || null,
      jiraAssigneeName: form.jiraAssigneeId ? form.jiraAssigneeName || null : null,
      startDate: form.startDate || undefined,
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

const STATUS_COLOURS: Record<string, string> = {
  NOT_STARTED: 'oklch(0.6 0.01 286)',
  PLANNED: 'oklch(0.62 0.17 255)',
  IN_PROGRESS: 'oklch(0.58 0.2 292)',
  COMPLETED: 'oklch(0.65 0.15 160)',
  DEFERRED: 'oklch(0.75 0.15 75)',
  OVERDUE: 'oklch(0.6 0.21 25)',
};

function toItem(action: ApiUpgradeAction): GanttItem {
  const completed = action.status === 'COMPLETED' || action.derivedStatus === 'COMPLETED';
  const overdue = action.derivedStatus === 'OVERDUE';
  const key = completed ? 'COMPLETED' : overdue ? 'OVERDUE' : action.status;
  const subs = action.subtasks ?? [];
  const subStarts = subs.map((s) => s.startDate ?? s.dueDate).filter((d): d is string => !!d).sort();
  const subEnds = subs.map((s) => s.dueDate ?? s.startDate).filter((d): d is string => !!d).sort();
  const end = action.plannedDate ?? subEnds.at(-1) ?? shiftDays(action.startDate ?? action.createdAt.slice(0, 10), 14);
  const start = action.startDate ?? subStarts[0] ?? shiftDays(end, -14);

  const estimate = subs.reduce((sum, s) => sum + (s.estimateSeconds ?? 0), 0);
  const spent = subs.reduce((sum, s) => sum + Math.min(s.spentSeconds ?? 0, s.estimateSeconds ?? Infinity), 0);
  const jira = estimate
    ? spent / estimate
    : action.jiraSubtaskTotal
      ? (action.jiraSubtaskDone ?? 0) / action.jiraSubtaskTotal
      : null;
  const envs = action.progress.total ? action.progress.done / action.progress.total : 0;

  return {
    id: action.id,
    name: action.targetVersion
      ? `${action.technology} ${action.cycle} → ${action.targetVersion}`
      : `${action.technology} ${action.cycle}`,
    technology: action.technology,
    statusLabel: key === 'OVERDUE' ? 'Overdue' : key.charAt(0) + key.slice(1).toLowerCase().replace('_', ' '),
    colour: STATUS_COLOURS[key] ?? STATUS_COLOURS['NOT_STARTED']!,
    people: action.jiraAssignee ? [action.jiraAssignee] : action.team ? [action.team.name] : [],
    start: start <= end ? start : end,
    end,
    due: action.plannedDate,
    overdue,
    progress: completed ? 1 : Math.max(jira ?? 0, envs),
    eol: action.eolDate,
    riskExpiry: action.decision === 'ACCEPT_RISK' ? action.riskExpiresAt : null,
    jiraKey: action.jiraKey,
    jiraUrl: action.jiraUrl,
    jiraError: action.jiraSyncError,
    subs: (action.subtasks ?? []).map(toSub),
  };
}

const CATEGORY_COLOURS: Record<string, string> = {
  'to-do': STATUS_COLOURS['NOT_STARTED']!,
  'in-progress': STATUS_COLOURS['IN_PROGRESS']!,
  done: STATUS_COLOURS['COMPLETED']!,
};

function toSub(task: ApiJiraSubtask): GanttSub {
  const done = task.statusCategory === 'done';
  const logged = task.estimateSeconds ? Math.min(1, (task.spentSeconds ?? 0) / task.estimateSeconds) : 0;
  return {
    key: task.key,
    summary: task.summary,
    status: task.status,
    colour: CATEGORY_COLOURS[task.statusCategory] ?? STATUS_COLOURS['NOT_STARTED']!,
    assignee: task.assignee,
    start: task.startDate,
    end: task.dueDate,
    estimate: task.estimateSeconds,
    spent: task.spentSeconds,
    progress: done ? 1 : logged,
    url: task.url,
  };
}

function blank(): Draft {
  return {
    technology: '',
    technologyCycleId: '',
    targetVersion: '',
    status: 'PLANNED',
    startDate: '',
    plannedDate: '',
    jiraAssigneeId: '',
    jiraAssigneeName: '',
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
