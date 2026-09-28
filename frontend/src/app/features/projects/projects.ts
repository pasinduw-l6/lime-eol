import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../../core/api';
import { RegistryStore } from '../../core/registry.store';
import { Modal } from '../../shared/modal';
import { EnvironmentName, Project, ProjectStatus } from '../../core/models';
import { Environments } from '../environments/environments';

const LIME_VERSIONS = ['2026.2', '2026.1', '2025.4'];

const ALL_ENVIRONMENTS: EnvironmentName[] = ['DEV', 'UAT', 'PROD'];

@Component({
  selector: 'lime-projects',
  imports: [FormsModule, Modal, Environments],
  host: { class: 'block' },
  template: `
    <section class="card mb-5 px-7 py-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="m-0 text-[30px] font-semibold tracking-[-0.02em]">Projects</h1>
          <p class="m-0 text-[14px] text-ink-soft">
            {{ projects().length }} customer installations ·
            {{ atRiskProjects() }} with something out of support
          </p>
        </div>
        <button type="button" class="btn btn-primary" (click)="toggleForm()">
          {{ showForm() ? 'Cancel' : 'New project' }}
        </button>
      </div>

      @if (showForm()) {
        <form
          class="mt-6 grid gap-5 border-t border-rule pt-6 lg:grid-cols-2"
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
                <select
                  name="limeVersion"
                  [(ngModel)]="form.limeVersion"
                  class="mt-1 w-full rounded-lg border border-rule bg-elevated px-3 py-2 text-[14px] text-ink"
                >
                  @for (v of limeVersions; track v) {
                    <option [value]="v">{{ v }}</option>
                  }
                </select>
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
                    class="glass rounded-full border px-4 py-1.5 text-[13px]"
                    [class.border-accent]="form.environments.includes(env)"
                    [class.bg-accent]="form.environments.includes(env)"
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
                    class="glass flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]"
                    [class.border-accent]="form.engineerIds.includes(e.id)"
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
                    class="input mt-0"
                    [(ngModel)]="row.technology"
                    [name]="'tech' + $index"
                  >
                    <option value="">Technology…</option>
                    @for (t of technologies(); track t.id) {
                      <option [value]="t.name">{{ t.name }}</option>
                    }
                  </select>
                  <input
                    class="input tabular mt-0"
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

              <button type="button" class="btn mt-1" (click)="addStackRow()">
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
              <button type="submit" class="btn btn-primary">Create project</button>
              <button type="button" class="btn" (click)="toggleForm()">Cancel</button>
            </div>
          </div>
        </form>
      }
    </section>

    <section class="card mb-5 flex flex-wrap items-center gap-3 px-7 py-4">
      <input
        type="search"
        [(ngModel)]="query"
        placeholder="Search project, customer or code"
        aria-label="Search projects"
        class="min-w-[240px] flex-1 rounded-full border border-rule bg-elevated px-4 py-2 text-[14px] text-ink"
      />
      <div class="glass flex gap-1 rounded-full border border-rule bg-elevated p-1">
        @for (f of statusFilters; track f) {
          <button
            type="button"
            class="rounded-full px-3.5 py-1.5 text-[13px] capitalize"
            [class.bg-ink]="statusFilter() === f"
            [class.text-ground]="statusFilter() === f"
            [class.text-ink-soft]="statusFilter() !== f"
            (click)="statusFilter.set(f)"
          >
            {{ f.toLowerCase() }}
          </button>
        }
      </div>
      <span class="tabular text-[13px] text-ink-soft">{{ filtered().length }} shown</span>
    </section>

    <section class="card overflow-hidden">
      <table class="w-full border-collapse text-[14px]">
        <caption class="sr-only">Projects with Lime version, staffing and risk</caption>
        <thead>
          <tr class="border-b border-rule text-left text-[12px] text-ink-soft">
            <th class="px-6 py-3 font-medium">Project</th>
            <th class="px-3 py-3 font-medium">Lime</th>
            <th class="px-3 py-3 font-medium">Environments</th>
            <th class="px-3 py-3 font-medium">Engineers</th>
            <th class="px-3 py-3 font-medium">At risk</th>
            <th class="px-6 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          @for (row of filtered(); track row.project.id) {
            <tr class="border-b border-rule last:border-b-0">
              <td class="px-6 py-3">
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
              <td class="tabular px-3 py-3">{{ row.project.limeVersion }}</td>
              <td class="px-3 py-3 text-ink-soft">
                {{ row.environments.join(', ') || '—' }}
              </td>
              <td class="px-3 py-3">
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
              <td class="tabular px-3 py-3">
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
              <td class="px-6 py-3">
                <span class="flex items-center justify-end gap-3">
                  <span
                    class="rounded-full border px-2.5 py-0.5 text-[12px]"
                    [class.border-rule]="row.project.status !== 'ACTIVE'"
                    [class.text-ink-soft]="row.project.status !== 'ACTIVE'"
                    [class.border-accent]="row.project.status === 'ACTIVE'"
                    [class.text-accent-bright]="row.project.status === 'ACTIVE'"
                  >
                    {{ row.project.status.toLowerCase() }}
                  </span>
                  <button type="button" class="text-[12px] text-accent-bright" (click)="manage(row.project)">
                    Manage
                  </button>
                </span>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="px-6 py-8 text-center text-ink-soft">
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
            <label class="field">
              Project name
              <input class="input" [(ngModel)]="editForm.name" name="ename" />
            </label>
            <label class="field">
              Lime version
              <select class="input" [(ngModel)]="editForm.limeVersion" name="elime">
                @for (v of limeVersions; track v) {
                  <option [value]="v">{{ v }}</option>
                }
              </select>
            </label>
          </div>

          <label class="field">
            Status
            <select class="input" [(ngModel)]="editForm.status" name="estatus">
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
                  class="glass rounded-full border px-3 py-1.5 text-[12px]"
                  [class.border-accent]="editForm.engineerIds.includes(e.id)"
                  [class.bg-elevated]="editForm.engineerIds.includes(e.id)"
                  [class.border-rule]="!editForm.engineerIds.includes(e.id)"
                  (click)="toggleEditEngineer(e.id)"
                >
                  {{ e.name }}
                </button>
              }
            </div>
          </fieldset>

          <div>
            <h3 class="m-0 mb-2 text-[13px] font-semibold">Environments</h3>
            <ul class="m-0 mb-3 flex list-none flex-col gap-2 p-0">
              @for (d of environmentsOf(project.id); track d.id) {
                <li class="flex items-center justify-between gap-3 rounded-lg border border-rule px-3 py-2">
                  <span class="min-w-0">
                    <span class="block text-[13px]">{{ d.environment }} · {{ d.locationDetail }}</span>
                    <span class="tabular block text-[11px] text-ink-soft">
                      {{ d.components.length }} components
                    </span>
                  </span>
                  <button type="button" class="text-[12px] text-overdue" (click)="removeEnvironment(d.id)">
                    Remove
                  </button>
                </li>
              } @empty {
                <li class="text-[13px] text-ink-soft">No environments yet.</li>
              }
            </ul>

            <div class="flex flex-wrap items-end gap-2">
              <label class="field flex-1">
                Add environment
                <select class="input" [(ngModel)]="newEnv" name="newenv">
                  @for (env of allEnvironments; track env) {
                    <option [value]="env">{{ env }}</option>
                  }
                </select>
              </label>
              <label class="field flex-1">
                Region or site
                <input class="input" [(ngModel)]="newEnvDetail" name="newdetail" placeholder="eu-west-1" />
              </label>
              <button type="button" class="btn" (click)="addEnvironment(project.id)">Add</button>
            </div>
          </div>

          @if (manageError()) {
            <p class="m-0 text-[13px] text-overdue" role="alert">{{ manageError() }}</p>
          }

          <div class="flex flex-wrap justify-between gap-2 border-t border-rule pt-4">
            <button type="button" class="btn btn-danger" (click)="confirmDelete.set(project)">
              Delete project
            </button>
            <span class="flex gap-2">
              <button type="button" class="btn" (click)="managed.set(null)">Cancel</button>
              <button type="button" class="btn btn-primary" (click)="saveProject(project.id)">
                Save changes
              </button>
            </span>
          </div>
        </div>
      </lime-modal>
    }

    @if (confirmDelete(); as project) {
      <lime-modal
        title="Delete this project?"
        [subtitle]="project.name"
        (dismiss)="confirmDelete.set(null)"
      >
        <p class="m-0 mb-4 text-[14px] text-ink-soft">
          This removes {{ environmentsOf(project.id).length }} environment(s) and
          their full revision history. The upgrade record for this customer will
          be gone. This cannot be undone.
        </p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" (click)="confirmDelete.set(null)">Keep it</button>
          <button type="button" class="btn btn-danger" (click)="deleteProject(project.id)">
            Delete everything
          </button>
        </div>
      </lime-modal>
    }
  `,
})
export class Projects {
  private readonly store = inject(RegistryStore);
  private readonly api = inject(Api);
  protected readonly saving = signal(false);
  private readonly router = inject(Router);

  protected readonly projects = this.store.projects;
  protected readonly engineers = this.store.engineers;
  protected readonly limeVersions = LIME_VERSIONS;
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
    limeVersion: LIME_VERSIONS[0],
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

  protected editForm = {
    name: '',
    limeVersion: LIME_VERSIONS[0],
    status: 'ACTIVE' as ProjectStatus,
    engineerIds: [] as string[],
  };

  protected manage(project: Project): void {
    this.editForm = {
      name: project.name,
      limeVersion: project.limeVersion,
      status: project.status,
      engineerIds: [...project.engineerIds],
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
    this.manageError.set(
      this.store.addEnvironment(
        projectId,
        this.newEnv(),
        'EC2',
        this.newEnvDetail() || 'not recorded',
      ),
    );
    this.newEnvDetail.set('');
  }

  protected removeEnvironment(id: string): void {
    this.store.deleteDeployment(id);
  }

  protected saveProject(id: string): void {
    const { engineerIds } = this.editForm;
    this.store.updateProject(id, { ...this.editForm });

    this.api.setEngineers(id, engineerIds).subscribe({
      next: () => this.api.reload(),
      error: () =>
        this.manageError.set(
          'Those details were kept in this browser, but the engineer list could not be saved.',
        ),
    });

    this.managed.set(null);
  }

  protected deleteProject(id: string): void {
    this.store.deleteProject(id);
    this.confirmDelete.set(null);
    this.managed.set(null);
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
