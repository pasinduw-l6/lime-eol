import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, ApiArchived, CommercialModel } from '../../core/api';
import { Feedback } from '../../core/feedback';
import { SessionStore } from '../../core/session';
import { COMMERCIAL_MODELS } from '../../core/process';
import { RegistryStore } from '../../core/registry.store';
import { Modal } from '../../shared/modal';
import { Deployment, EnvironmentName, Project, ProjectStatus } from '../../core/models';
import { Environments } from '../environments/environments';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';

const ALL_ENVIRONMENTS: EnvironmentName[] = ['DEV', 'UAT', 'PROD'];

@Component({
  selector: 'lime-projects',
  imports: [HlmCardImports, HlmButton, HlmInput, HlmLabel, HlmTableImports, FormsModule, Modal, Environments],
  host: { class: 'block' },
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-3xl font-semibold tracking-tight">Projects</h1>
        <p class="m-0 mt-1 text-sm text-muted-foreground">
          {{ projects().length }} customer installations ·
          {{ atRiskProjects() }} with something out of support
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" [checked]="showArchived()" (change)="toggleArchived()" />
          Show archived
        </label>
        @if (canWrite()) {
          <button type="button" hlmBtn [variant]="showForm() ? 'outline' : 'default'" (click)="toggleForm()">
            {{ showForm() ? 'Cancel' : 'New project' }}
          </button>
        }
      </div>
    </header>

    @if (showArchived()) {
      <section hlmCard class="mb-5" aria-labelledby="archived-projects">
        <div hlmCardHeader>
          <h2 hlmCardTitle id="archived-projects">Archived projects</h2>
          <p hlmCardDescription>Restoring a project brings back the environments archived with it.</p>
        </div>
        <div hlmCardContent>
          <ul class="m-0 grid list-none gap-2 p-0">
            @for (p of archived(); track p.id) {
              <li class="flex items-center justify-between gap-3 rounded-md border px-4 py-2 text-sm">
                <span>
                  {{ p.name }}
                  <span class="text-muted-foreground">· {{ p.customer }} · {{ p.code }}</span>
                </span>
                @if (canWrite()) {
                  <button type="button" hlmBtn variant="outline" size="sm" (click)="restoreProject(p.id, p.name)">Restore</button>
                }
              </li>
            } @empty {
              <li class="text-sm text-muted-foreground">Nothing archived.</li>
            }
          </ul>
        </div>
      </section>
    }

    @if (showForm()) {
      <section hlmCard class="mb-5" aria-labelledby="new-project">
        <div hlmCardHeader>
          <h2 hlmCardTitle id="new-project">New project</h2>
          <p hlmCardDescription>Each environment starts with the stack you list, recorded as its first entry in the change history.</p>
        </div>
        <form
          hlmCardContent
          class="grid gap-5 lg:grid-cols-2"
          (submit)="create($event)"
        >
          <div class="grid gap-4">
            <label class="block text-[12px] text-ink-soft">
              Project name
              <input
                required
                name="name"
                [(ngModel)]="form.name"
                placeholder="Acme Bank — Core"
                class="mt-1 w-full rounded-lg border border-rule bg-elevated px-3 py-2 text-[14px] text-ink"
              />
            </label>

            <div class="grid grid-cols-[1fr_120px] gap-3">
              <label class="block text-[12px] text-ink-soft">
                Customer
                <input
                  required
                  name="customer"
                  [(ngModel)]="form.customer"
                  class="mt-1 w-full rounded-lg border border-rule bg-elevated px-3 py-2 text-[14px] text-ink"
                />
              </label>
              <label class="block text-[12px] text-ink-soft">
                Code
                <input
                  required
                  name="code"
                  [(ngModel)]="form.code"
                  maxlength="6"
                  placeholder="ACME"
                  class="tabular mt-1 w-full rounded-lg border border-rule bg-elevated px-3 py-2 text-[14px] text-ink uppercase"
                />
              </label>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <label class="block text-[12px] text-ink-soft">
                Lime version
                <input
                  name="limeVersion"
                  list="lime-versions"
                  [(ngModel)]="form.limeVersion"
                  placeholder="none"
                  class="tabular mt-1 w-full rounded-lg border border-rule bg-elevated px-3 py-2 text-[14px] text-ink"
                />
              </label>
              <label class="block text-[12px] text-ink-soft">
                Status
                <select
                  name="status"
                  [(ngModel)]="form.status"
                  class="mt-1 w-full rounded-lg border border-rule bg-elevated px-3 py-2 text-[14px] text-ink"
                >
                  @for (s of statuses; track s) {
                    <option [value]="s">{{ s }}</option>
                  }
                </select>
              </label>
            </div>

            <div class="grid grid-cols-[140px_1fr] gap-3">
              <label class="block text-[12px] text-ink-soft">
                Hosting
                <select
                  name="location"
                  [(ngModel)]="form.location"
                  class="mt-1 w-full rounded-lg border border-rule bg-elevated px-3 py-2 text-[14px] text-ink"
                >
                  <option value="EC2">AWS</option>
                  <option value="CUSTOMER_SITE">Customer site</option>
                </select>
              </label>
              <label class="block text-[12px] text-ink-soft">
                Region or site
                <input
                  name="locationDetail"
                  [(ngModel)]="form.locationDetail"
                  placeholder="eu-west-1"
                  class="mt-1 w-full rounded-lg border border-rule bg-elevated px-3 py-2 text-[14px] text-ink"
                />
              </label>
            </div>
          </div>

          <div class="grid content-start gap-5">
            <fieldset class="m-0 border-0 p-0">
              <legend class="mb-2 p-0 text-[12px] text-ink-soft">Environments</legend>
              <div class="flex flex-wrap gap-2">
                @for (env of allEnvironments; track env) {
                  <button
                    type="button"
                    class="glass rounded-md border px-4 py-1.5 text-[13px]"
                    [class.border-primary]="form.environments.includes(env)"
                    [class.bg-primary]="form.environments.includes(env)"
                    [class.border-rule]="!form.environments.includes(env)"
                    (click)="toggleEnv(env)"
                  >
                    {{ env }}
                  </button>
                }
              </div>
            </fieldset>

            <fieldset class="m-0 border-0 p-0">
              <legend class="mb-2 p-0 text-[12px] text-ink-soft">
                Assigned engineers
              </legend>
              <div class="flex flex-wrap gap-2">
                @for (e of engineers(); track e.id) {
                  <button
                    type="button"
                    class="glass flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px]"
                    [class.border-primary]="form.engineerIds.includes(e.id)"
                    [class.bg-elevated]="form.engineerIds.includes(e.id)"
                    [class.border-rule]="!form.engineerIds.includes(e.id)"
                    (click)="toggleEngineer(e.id)"
                  >
                    <span
                      class="grid h-6 w-6 place-items-center rounded-full brand-gradient text-[10px] text-ink"
                      >{{ e.initials }}</span
                    >
                    {{ e.name }}
                  </button>
                }
              </div>
            </fieldset>

            <fieldset class="m-0 border-0 p-0">
              <legend class="mb-2 p-0 text-[12px] text-ink-soft">
                Technology stack
              </legend>

              @for (row of form.stack; track $index) {
                <div class="mb-2 grid grid-cols-[1fr_130px_32px] gap-2">
                  <select
                    hlmInput
                    [(ngModel)]="row.technology"
                    [name]="'tech' + $index"
                  >
                    <option value="">Technology…</option>
                    @for (t of technologies(); track t.id) {
                      <option [value]="t.name">{{ t.name }}</option>
                    }
                  </select>
                  <input
                    hlmInput class="tabular"
                    [(ngModel)]="row.version"
                    [name]="'ver' + $index"
                    [attr.list]="'versions-' + $index"
                    placeholder="version"
                  />
                  <datalist [id]="'versions-' + $index">
                    @for (v of versionsFor(row.technology); track v) {
                      <option [value]="v"></option>
                    }
                  </datalist>
                  <button
                    type="button"
                    class="text-[16px] text-ink-soft hover:text-overdue"
                    (click)="removeStackRow($index)"
                    [attr.aria-label]="'Remove ' + (row.technology || 'row')"
                  >
                    ×
                  </button>
                </div>
              }

              <button type="button" hlmBtn variant="outline" class="mt-1" (click)="addStackRow()">
                Add component
              </button>
            </fieldset>

            <p class="m-0 text-[12px] text-ink-soft">
              Every environment starts with this stack, and each component is
              recorded as an install in its change history — so the project has a
              complete record from day one. Anything missing here can be added
              per environment afterwards.
            </p>

            @if (error()) {
              <p class="m-0 text-[13px] text-overdue" role="alert">{{ error() }}</p>
            }

            <div class="flex gap-2">
              <button type="submit" hlmBtn>Create project</button>
              <button type="button" hlmBtn variant="outline" (click)="toggleForm()">Cancel</button>
            </div>
          </div>
        </form>
      </section>
    }

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <input
        hlmInput
        type="search"
        [(ngModel)]="query"
        placeholder="Search project, customer or code"
        aria-label="Search projects"
        class="max-w-sm min-w-[240px] flex-1"
      />
      <div class="segmented">
        @for (f of statusFilters; track f) {
          <button
            type="button"
            class="px-3.5 py-1 text-[13px] capitalize"
            [class.bg-background]="statusFilter() === f" [class.shadow-sm]="statusFilter() === f"
            [class.text-foreground]="statusFilter() === f"
            [class.text-ink-soft]="statusFilter() !== f"
            (click)="statusFilter.set(f)"
          >
            {{ f.toLowerCase() }}
          </button>
        }
      </div>
      <span class="tabular ml-auto text-sm text-muted-foreground">{{ filtered().length }} shown</span>
    </div>

    <section hlmCard class="block overflow-hidden py-0">
      <table hlmTable class="w-full border-collapse text-[14px]">
        <caption class="sr-only">Projects with Lime version, staffing and risk</caption>
        <thead hlmTHead>
          <tr hlmTr class="border-b border-rule text-left text-[12px] text-ink-soft">
            <th hlmTh class="px-6 py-3 font-medium">Project</th>
            <th hlmTh class="px-3 py-3 font-medium">Lime</th>
            <th hlmTh class="px-3 py-3 font-medium">Environments</th>
            <th hlmTh class="px-3 py-3 font-medium">Engineers</th>
            <th hlmTh class="px-3 py-3 font-medium">At risk</th>
            <th hlmTh class="px-6 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody hlmTBody>
          @for (row of filtered(); track row.project.id) {
            <tr hlmTr class="border-b border-rule last:border-b-0">
              <td hlmTd class="whitespace-normal px-6 py-3">
                <button
                  type="button"
                  class="text-left"
                  (click)="open(row.project)"
                  [attr.aria-label]="'Open ' + row.project.name"
                >
                  <span class="block font-medium">{{ row.project.name }}</span>
                  <span class="tabular block text-[12px] text-ink-soft">
                    {{ row.project.code }} · since {{ row.project.startedAt }}
                  </span>
                </button>
              </td>
              <td hlmTd class="whitespace-normal tabular px-3 py-3">{{ row.project.limeVersion }}</td>
              <td hlmTd class="whitespace-normal px-3 py-3 text-ink-soft">
                {{ row.environments.join(', ') || '—' }}
              </td>
              <td hlmTd class="whitespace-normal px-3 py-3">
                <span class="flex -space-x-1.5">
                  @for (e of row.engineers; track e.id) {
                    <span
                      class="grid h-7 w-7 place-items-center rounded-full border border-surface brand-gradient text-[10px]"
                      [attr.title]="e.name + ' · ' + e.role"
                      >{{ e.initials }}</span
                    >
                  }
                </span>
              </td>
              <td hlmTd class="whitespace-normal tabular px-3 py-3">
                @if (row.risk.eol > 0) {
                  <span class="text-overdue">{{ row.risk.eol }} EOL</span>
                }
                @if (row.risk.near > 0) {
                  <span class="text-soon">
                    @if (row.risk.eol > 0) {<span class="text-ink-faint"> · </span>}
                    {{ row.risk.near }} near
                  </span>
                }
                @if (row.risk.eol === 0 && row.risk.near === 0) {
                  <span class="text-ink-faint">clear</span>
                }
              </td>
              <td hlmTd class="whitespace-normal px-6 py-3">
                <span class="flex items-center justify-end gap-3">
                  <span
                    class="rounded-full border px-2.5 py-0.5 text-[12px]"
                    [class.border-rule]="row.project.status !== 'ACTIVE'"
                    [class.text-ink-soft]="row.project.status !== 'ACTIVE'"
                    [class.border-primary]="row.project.status === 'ACTIVE'"
                    [class.text-primary]="row.project.status === 'ACTIVE'"
                  >
                    {{ row.project.status.toLowerCase() }}
                  </span>
                  @if (canManage()) {
                    <button type="button" class="text-[12px] text-primary" (click)="manage(row.project)">
                      Manage
                    </button>
                  }
                </span>
              </td>
            </tr>
          } @empty {
            <tr hlmTr>
              <td hlmTd colspan="6" class="px-6 py-8 text-center text-ink-soft">
                No project matches that search.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </section>

    <lime-environments class="mt-5 block" />

    @if (managed(); as project) {
      <lime-modal
        [title]="project.name"
        [subtitle]="project.customer + ' · ' + project.code"
        (dismiss)="managed.set(null)"
      >
        <div class="grid gap-5">
          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Project name
              <input hlmInput [(ngModel)]="editForm.name" name="ename" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Lime version
              <input
                hlmInput class="tabular"
                list="lime-versions"
                [(ngModel)]="editForm.limeVersion"
                name="elime"
                placeholder="none"
              />
              <datalist id="lime-versions">
                @for (v of limeVersions(); track v) {
                  <option [value]="v"></option>
                }
              </datalist>
            </label>
          </div>

          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Status
            <select hlmInput [(ngModel)]="editForm.status" name="estatus">
              @for (s of statuses; track s) {
                <option [value]="s">{{ s.toLowerCase() }}</option>
              }
            </select>
          </label>

          <fieldset class="m-0 border-0 p-0">
            <legend class="mb-2 p-0 text-[12px] text-ink-soft">Assigned engineers</legend>
            <div class="flex flex-wrap gap-2">
              @for (e of engineers(); track e.id) {
                <button
                  type="button"
                  class="glass rounded-md border px-3 py-1.5 text-[12px]"
                  [class.border-primary]="editForm.engineerIds.includes(e.id)"
                  [class.bg-elevated]="editForm.engineerIds.includes(e.id)"
                  [class.border-rule]="!editForm.engineerIds.includes(e.id)"
                  (click)="toggleEditEngineer(e.id)"
                >
                  {{ e.name }}
                </button>
              }
            </div>
          </fieldset>

          <fieldset class="m-0 grid gap-3 rounded-lg border p-4">
            <legend class="px-1 text-sm font-medium">Customer agreement · {{ project.customer }}</legend>
            <div class="grid gap-3 sm:grid-cols-3">
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Commercial model
                <select hlmInput [(ngModel)]="editForm.commercialModel" name="model">
                  <option value="">Not set</option>
                  @for (m of commercialModels; track m.key) {
                    <option [value]="m.key">{{ m.label }}</option>
                  }
                </select>
              </label>
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Contract start
                <input type="date" hlmInput [(ngModel)]="editForm.contractStart" name="cstart" />
              </label>
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Contract end
                <input type="date" hlmInput [(ngModel)]="editForm.contractEnd" name="cend" />
              </label>
            </div>
            <p class="m-0 text-[12px] text-muted-foreground">
              Subscription: infrastructure upgrades are included for the contract period, application
              dependencies come with Lime releases. License: upgrades are assessed and quoted separately.
              Shared by every project of this customer.
            </p>
          </fieldset>

          <div>
            <h3 class="m-0 mb-2 text-[13px] font-semibold">Environments</h3>
            <ul class="m-0 mb-3 flex list-none flex-col gap-2 p-0">
              @for (d of environmentsOf(project.id); track d.id) {
                <li class="grid gap-2 rounded-lg border border-rule px-3 py-2 sm:grid-cols-[1fr_200px_auto] sm:items-center">
                  <span class="min-w-0">
                    <span class="block text-[13px]">{{ d.environment }} · {{ d.locationDetail }}</span>
                    <span class="tabular block text-[11px] text-ink-soft">
                      {{ d.components.length }} components
                    </span>
                  </span>
                  <select
                    hlmInput
                    class="h-8"
                    [value]="ownerOf(d)"
                    [disabled]="busy() || !canWrite()"
                    [attr.aria-label]="'Owning team for ' + d.environment"
                    (change)="setOwner(d, $any($event.target).value)"
                  >
                    <option value="">No owning team</option>
                    @for (t of api.teams(); track t.id) {
                      <option [value]="t.id">{{ t.name }}</option>
                    }
                  </select>
                  @if (canWrite()) {
                    <button type="button" class="text-[12px] text-overdue" [disabled]="busy()" (click)="removeEnvironment(d)">
                      Archive
                    </button>
                  }
                </li>
              } @empty {
                <li class="text-[13px] text-ink-soft">No environments yet.</li>
              }
            </ul>

            <div class="flex flex-wrap items-end gap-2">
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal flex-1">
                Add environment
                <select hlmInput [(ngModel)]="newEnv" name="newenv">
                  @for (env of allEnvironments; track env) {
                    <option [value]="env">{{ env }}</option>
                  }
                </select>
              </label>
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal flex-1">
                Region or site
                <input hlmInput [(ngModel)]="newEnvDetail" name="newdetail" placeholder="eu-west-1" />
              </label>
              @if (environmentsOf(project.id).length > 0) {
                <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal flex-1">
                  Start with the components of
                  <select hlmInput [(ngModel)]="copyFrom" name="copyfrom">
                    <option value="">Nothing</option>
                    @for (d of environmentsOf(project.id); track d.id) {
                      <option [value]="d.id">{{ d.environment }}</option>
                    }
                  </select>
                </label>
              }
              <button type="button" hlmBtn variant="outline" [disabled]="busy()" (click)="addEnvironment(project.id)">Add</button>
            </div>
          </div>

          @if (manageError()) {
            <p class="m-0 text-[13px] text-overdue" role="alert">{{ manageError() }}</p>
          }

          <div class="flex flex-wrap justify-between gap-2 border-t border-rule pt-4">
            <button type="button" hlmBtn variant="destructive" (click)="confirmDelete.set(project)">
              Archive project
            </button>
            <span class="flex gap-2">
              <button type="button" hlmBtn variant="outline" (click)="managed.set(null)">Cancel</button>
              <button type="button" hlmBtn (click)="saveProject(project.id)">
                Save changes
              </button>
            </span>
          </div>
        </div>
      </lime-modal>
    }

    @if (confirmDelete(); as project) {
      <lime-modal
        title="Archive this project?"
        [subtitle]="project.name"
        (dismiss)="confirmDelete.set(null)"
      >
        <p class="m-0 mb-4 text-[14px] text-ink-soft">
          {{ project.name }} and its {{ environmentsOf(project.id).length }} environment(s)
          disappear from every list. Their change history and upgrade plans are kept.
        </p>
        @if (manageError()) {
          <p class="m-0 mb-4 text-[13px] text-overdue" role="alert">{{ manageError() }}</p>
        }
        <div class="flex justify-end gap-2">
          <button type="button" hlmBtn variant="outline" (click)="confirmDelete.set(null)">Keep it</button>
          <button type="button" hlmBtn variant="destructive" [disabled]="busy()" (click)="deleteProject(project.id)">
            Archive project
          </button>
        </div>
      </lime-modal>
    }
  `,
})
export class Projects {
  private readonly store = inject(RegistryStore);
  protected readonly api = inject(Api);
  protected readonly saving = signal(false);
  private readonly router = inject(Router);

  protected readonly projects = this.store.projects;
  protected readonly engineers = this.store.engineers;
  protected readonly limeVersions = computed(() =>
    [
      ...new Set(
        this.store
          .projects()
          .map((p) => p.limeVersion)
          .filter((v): v is string => !!v),
      ),
    ].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
  );
  protected readonly allEnvironments = ALL_ENVIRONMENTS;
  protected readonly statuses: ProjectStatus[] = ['ACTIVE', 'ONBOARDING', 'PAUSED'];
  protected readonly statusFilters = ['ALL', 'ACTIVE', 'ONBOARDING', 'PAUSED'] as const;

  protected readonly query = signal('');
  protected readonly statusFilter = signal<(typeof this.statusFilters)[number]>('ALL');
  protected readonly showForm = signal(false);
  protected readonly error = signal<string | null>(null);

  protected form = {
    name: '',
    customer: '',
    code: '',
    limeVersion: '',
    status: 'ONBOARDING' as ProjectStatus,
    engineerIds: [] as string[],
    environments: ['PROD'] as EnvironmentName[],
    location: 'EC2' as 'EC2' | 'CUSTOMER_SITE',
    locationDetail: '',
    stack: [{ technology: '', version: '' }] as {
      technology: string;
      version: string;
    }[],
  };

  protected readonly technologies = this.store.technologies;

  protected versionsFor(technology: string): string[] {
    return this.store
      .cycles()
      .filter((c) => c.technology === technology)
      .flatMap((c) => [...c.versions, c.latestPatch ?? ''])
      .filter(Boolean)
      .filter((v, i, all) => all.indexOf(v) === i);
  }

  protected addStackRow(): void {
    this.form.stack = [...this.form.stack, { technology: '', version: '' }];
  }

  protected removeStackRow(index: number): void {
    this.form.stack = this.form.stack.filter((_, i) => i !== index);
  }

  protected readonly rows = computed(() =>
    this.store.projects().map((project) => ({
      project,
      engineers: this.store.engineersFor(project),
      risk: this.store.riskOf(project.id),
      environments: this.store
        .deploymentsOf(project.id)
        .map((d) => d.environment),
    })),
  );

  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const status = this.statusFilter();

    return this.rows()
      .filter((r) => status === 'ALL' || r.project.status === status)
      .filter(
        (r) =>
          !needle ||
          r.project.name.toLowerCase().includes(needle) ||
          r.project.customer.toLowerCase().includes(needle) ||
          r.project.code.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.risk.eol - a.risk.eol || b.risk.near - a.risk.near);
  });

  protected readonly atRiskProjects = computed(
    () => this.rows().filter((r) => r.risk.eol > 0 || r.risk.near > 0).length,
  );

  protected readonly managed = signal<Project | null>(null);
  protected readonly confirmDelete = signal<Project | null>(null);
  protected readonly manageError = signal<string | null>(null);
  protected readonly newEnv = signal<EnvironmentName>('UAT');
  protected readonly newEnvDetail = signal('');
  protected readonly copyFrom = signal('');
  protected readonly busy = signal(false);
  private readonly feedback = inject(Feedback);
  private readonly session = inject(SessionStore);
  protected readonly canWrite = computed(() => this.session.can('estate:write'));
  protected readonly canManage = this.canWrite;
  protected readonly showArchived = signal(false);
  protected readonly archived = signal<ApiArchived[]>([]);

  protected editForm = {
    name: '',
    limeVersion: '',
    status: 'ACTIVE' as ProjectStatus,
    engineerIds: [] as string[],
    commercialModel: '' as CommercialModel | '',
    contractStart: '',
    contractEnd: '',
  };

  protected readonly commercialModels = COMMERCIAL_MODELS;

  private customerOf(projectId: string) {
    const customerId = this.store.apiProject(projectId)?.customerId;
    return this.api.customers().find((c) => c.id === customerId);
  }

  protected manage(project: Project): void {
    this.editForm = {
      name: project.name,
      limeVersion: project.limeVersion,
      status: project.status,
      engineerIds: [...project.engineerIds],
      commercialModel: this.customerOf(project.id)?.commercialModel ?? '',
      contractStart: this.customerOf(project.id)?.contractStart ?? '',
      contractEnd: this.customerOf(project.id)?.contractEnd ?? '',
    };
    this.manageError.set(null);
    this.managed.set(project);
  }

  protected toggleEditEngineer(id: string): void {
    this.editForm.engineerIds = this.editForm.engineerIds.includes(id)
      ? this.editForm.engineerIds.filter((e) => e !== id)
      : [...this.editForm.engineerIds, id];
  }

  protected environmentsOf(projectId: string) {
    return this.store.deploymentsOf(projectId);
  }

  protected addEnvironment(projectId: string): void {
    this.busy.set(true);
    this.api
      .addEnvironment(projectId, {
        environment: this.newEnv(),
        location: 'EC2',
        locationDetail: this.newEnvDetail().trim() || undefined,
        copyFrom: this.copyFrom() || undefined,
      })
      .subscribe(
        this.done(() => {
          this.newEnvDetail.set('');
          this.copyFrom.set('');
        }, 'That environment could not be added.'),
      );
  }

  protected async removeEnvironment(environment: Deployment): Promise<void> {
    const ok = await this.feedback.confirm({
      title: `Archive ${environment.environment}?`,
      message: 'Its change history is kept. Adding the environment again restores it.',
      confirmLabel: 'Archive',
      destructive: true,
    });
    if (!ok) return;

    this.busy.set(true);
    this.api
      .archiveEnvironment(environment.id)
      .subscribe(
        this.done(
          () => this.feedback.success(`${environment.environment} archived.`),
          'That environment could not be archived.',
        ),
      );
  }

  protected ownerOf(environment: Deployment): string {
    const name = environment.owners[0];
    return this.api.teams().find((t) => t.name === name)?.id ?? '';
  }

  protected setOwner(environment: Deployment, teamId: string): void {
    this.busy.set(true);
    this.api
      .setOwners(environment.id, teamId ? [teamId] : [])
      .subscribe(
        this.done(
          () => this.feedback.success(`Owner of ${environment.environment} saved.`),
          'Could not set the owning team.',
        ),
      );
  }

  protected toggleArchived(): void {
    this.showArchived.update((v) => !v);
    this.loadArchived();
  }

  private loadArchived(): void {
    if (!this.showArchived()) return;
    this.api.archivedProjects().subscribe({
      next: (rows) => this.archived.set(rows),
      error: (err) => this.feedback.failed(err, 'Could not load archived projects.'),
    });
  }

  protected restoreProject(id: string, name: string): void {
    this.api.restoreProject(id).subscribe({
      next: () => {
        this.feedback.success(`${name} restored.`);
        this.api.reload();
        this.loadArchived();
      },
      error: (err) => this.feedback.failed(err, `${name} could not be restored.`),
    });
  }

  private done(after: () => void, fallback: string) {
    return {
      next: () => {
        this.busy.set(false);
        this.manageError.set(null);
        after();
        this.api.reload();
      },
      error: (err: { error?: { message?: string | string[] } }) => {
        this.busy.set(false);
        const message = err.error?.message;
        this.manageError.set(Array.isArray(message) ? message.join('. ') : (message ?? fallback));
      },
    };
  }

  protected saveProject(id: string): void {
    const { engineerIds, name, limeVersion, status, commercialModel, contractStart, contractEnd } =
      this.editForm;
    const customer = this.customerOf(id);

    this.store.updateProject(id, { name, limeVersion, status, engineerIds });
    this.managed.set(null);

    this.api.updateProject(id, { name, limeVersion, status }).subscribe({
      next: () =>
        this.api.setEngineers(id, engineerIds).subscribe({
          next: () => {
            if (!customer) {
              this.api.reload();
              return;
            }
            this.api
              .updateCustomer(customer.id, {
                commercialModel: commercialModel || null,
                contractStart: contractStart || null,
                contractEnd: contractEnd || null,
              })
              .subscribe({
                next: () => this.api.reload(),
                error: (err: { error?: { message?: string | string[] } }) => {
                  this.api.reload();
                  const detail = err.error?.message;
                  this.manageError.set(
                    Array.isArray(detail) ? detail.join('. ') : (detail ?? 'The customer agreement could not be saved.'),
                  );
                },
              });
          },
          error: () => {
            this.api.reload();
            this.manageError.set('The engineer list could not be saved.');
          },
        }),
      error: (error: { error?: { message?: string | string[] } }) => {
        this.api.reload();
        const detail = error.error?.message;
        this.manageError.set(
          Array.isArray(detail)
            ? detail.join('. ')
            : (detail ?? 'Those changes could not be saved.'),
        );
      },
    });
  }

  protected deleteProject(id: string): void {
    const name = this.confirmDelete()?.name ?? 'Project';
    this.busy.set(true);
    this.api.archiveProject(id).subscribe(
      this.done(() => {
        this.confirmDelete.set(null);
        this.managed.set(null);
        this.feedback.success(`${name} archived.`, {
          label: 'Undo',
          run: () => this.restoreProject(id, name),
        });
        this.loadArchived();
      }, 'That project could not be archived.'),
    );
  }

  protected toggleForm(): void {
    this.showForm.update((open) => !open);
    this.error.set(null);
  }

  protected toggleEnv(env: EnvironmentName): void {
    this.form.environments = this.form.environments.includes(env)
      ? this.form.environments.filter((e) => e !== env)
      : [...this.form.environments, env];
  }

  protected toggleEngineer(id: string): void {
    this.form.engineerIds = this.form.engineerIds.includes(id)
      ? this.form.engineerIds.filter((e) => e !== id)
      : [...this.form.engineerIds, id];
  }

  protected create(event: Event): void {
    event.preventDefault();

    if (!this.form.name.trim() || !this.form.customer.trim() || !this.form.code.trim()) {
      this.error.set('Project name, customer and code are all required.');
      return;
    }
    if (this.form.environments.length === 0) {
      this.error.set('Pick at least one environment to create.');
      return;
    }

    const stack = this.form.stack.filter(
      (row) => row.technology.trim() && row.version.trim(),
    );

    this.saving.set(true);
    this.api
      .createProject({
        name: this.form.name.trim(),
        customer: this.form.customer.trim(),
        code: this.form.code.trim().toUpperCase(),
        status: this.form.status,
        limeVersion: this.form.limeVersion,
        engineerIds: this.form.engineerIds,
        environments: this.form.environments.map((environment) => ({
          environment,
          location: this.form.location,
          locationDetail: this.form.locationDetail || undefined,
        })),
        stack,
      })
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.showForm.set(false);
          this.error.set(null);
          this.form = {
            ...this.form,
            name: '',
            customer: '',
            code: '',
            engineerIds: [],
            locationDetail: '',
            stack: [{ technology: '', version: '' }],
          };
          this.api.reload();
          this.store.scope.set(created.id);
        },
        error: (err: { error?: { message?: string | string[] } }) => {
          this.saving.set(false);
          const message = err.error?.message;
          this.error.set(
            Array.isArray(message)
              ? message.join('. ')
              : (message ?? 'Could not create that project.'),
          );
        },
      });
  }

  protected open(project: Project): void {
    this.store.scope.set(project.id);
    void this.router.navigate(['/overview']);
  }
}
