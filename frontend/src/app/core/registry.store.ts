import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { Api, ApiProject } from './api';
import { ComponentChange, summariseChange } from './diff';
import { daysToEol, statusOf, SupportStatus } from './lifecycle';
import {
  Cycle,
  Deployment,
  Engineer,
  EnvTopology,
  EnvironmentName,
  Project,
  Revision,
  Technology,
  UpgradeAction,
} from './models';

/** Everything, or one project. The switcher writes this. */
export type ProjectScope = 'all' | string;

export interface NewProject {
  name: string;
  customer: string;
  code: string;
  limeVersion: string;
  status: Project['status'];
  engineerIds: string[];
  environments: EnvironmentName[];
  location: Deployment['location'];
  locationDetail: string;
}

export interface ResolvedComponent {
  technology: string;
  version: string;
  cycle: Cycle | null;
  days: number | null;
  status: SupportStatus;
}

export interface InboxItem {
  kind: 'no-plan' | 'planned' | 'overdue-action';
  cycle: Cycle;
  days: number | null;
  deployments: Deployment[];
  action: UpgradeAction | null;
}

/**
 * Application state.
 *
 * Reads come from the API and are held in linked signals, so the server is the
 * source of truth but the UI can still edit locally. Anything the API does not
 * serve yet — upgrade actions, environment revisions — lives in plain signals
 * and is clearly marked as unsaved in the screens that write it.
 */
@Injectable({ providedIn: 'root' })
export class RegistryStore {
  private readonly api = inject(Api);

  readonly isLoading = this.api.isLoading;
  readonly loadError = this.api.error;

  /** True while writes are not yet persisted anywhere. */
  readonly writesArePersisted = false;

  // ---- server-derived state ------------------------------------------------

  private readonly _technologies = linkedSignal<Technology[]>(() =>
    this.api.technologies().map((t) => ({
      id: t.id,
      name: t.name,
      componentType: t.componentType as Technology['componentType'],
      vendor: t.vendor,
      eolSlug: t.eolSlug,
      cycleRule: t.cycleRule as Technology['cycleRule'],
      iconSlug: t.iconSlug,
      iconColour: t.iconColour,
      notes: t.notes,
    })),
  );

  private readonly _cycles = linkedSignal<Cycle[]>(() =>
    this.api.technologies().flatMap((technology) =>
      technology.cycles.map((cycle) => ({
        id: cycle.id,
        technology: technology.name,
        componentType: technology.componentType as Cycle['componentType'],
        cycle: cycle.cycle,
        label: cycle.label ?? cycle.cycle,
        releaseDate: cycle.releaseDate,
        eolDate: cycle.eolDate,
        activeSupportEnd: cycle.activeSupportEnd,
        isLts: cycle.isLts,
        isMaintained: cycle.isMaintained,
        latestPatch: cycle.latestPatch,
        eolSource: cycle.eolSource,
        versions: cycle.versions,
      })),
    ),
  );

  private readonly _projects = linkedSignal<Project[]>(() =>
    this.api.projects().map((p) => ({
      id: p.id,
      name: p.name,
      customer: p.customer,
      code: p.code,
      limeVersion: p.limeVersion ?? '—',
      status: p.status,
      engineerIds: p.engineers.map((e) => e.id),
      startedAt: p.startedAt ?? '',
    })),
  );

  private readonly _deployments = linkedSignal<Deployment[]>(() =>
    this.api.projects().flatMap((project) =>
      project.environments.map((env) => ({
        id: env.id,
        projectId: project.id,
        customer: project.customer,
        customerCode: project.code,
        name: `${project.name} ${env.environment}`,
        environment: env.environment,
        location: env.location as Deployment['location'],
        locationDetail: env.locationDetail ?? '',
        limeVersion: project.limeVersion,
        owners: env.owners,
        components: env.components.map((c) => ({
          technology: c.technology,
          version: c.version,
          source: 'LIME_DEFAULT' as const,
        })),
      })),
    ),
  );

  /**
   * Everyone who could be staffed, from the accounts API.
   *
   * Previously read off the projects themselves, which meant the picker only
   * ever offered people who were already assigned — a closed loop in which
   * nobody new could be added to anything.
   */
  private readonly _engineers = linkedSignal<Engineer[]>(() =>
    this.api.users().map((user) => ({
      id: user.id,
      name: user.name,
      initials: user.initials,
      email: user.email,
      canEdit: user.canEdit,
      role: user.canEdit ? ('Engineer' as const) : ('Viewer' as const),
    })),
  );

  /**
   * Upgrade actions, from the API.
   *
   * The Plan screen owns the writes; this is the read every other screen uses
   * — the Overview inbox to say whether a deadline has a plan, the Calendar to
   * place it on the timeline.
   */
  private readonly _actions = linkedSignal<UpgradeAction[]>(() =>
    this.api.actions().map((a) => ({
      id: a.id,
      technology: a.technology,
      cycle: a.cycle,
      targetVersion: a.targetVersion,
      // The derived one: OVERDUE and IN_PROGRESS are facts about progress,
      // not something anybody typed.
      status: (a.derivedStatus === 'OVERDUE'
        ? 'IN_PROGRESS'
        : a.derivedStatus) as UpgradeAction['status'],
      plannedDate: a.plannedDate,
      completedDate: a.completedDate,
      assignee: a.assignee?.name ?? null,
      team: a.team?.name ?? null,
      jiraKey: a.jiraKey,
      deploymentIds: a.environments.map((e) => e.deploymentId),
    })),
  );

  // ---- client-only state (no API yet) --------------------------------------

  private readonly _revisions = signal<Revision[]>([]);
  private readonly _topologies = signal<EnvTopology[]>([]);

  readonly scope = signal<ProjectScope>('all');

  readonly technologies = this._technologies.asReadonly();
  readonly cycles = this._cycles.asReadonly();
  readonly projects = this._projects.asReadonly();
  readonly engineers = this._engineers.asReadonly();
  readonly actions = this._actions.asReadonly();
  readonly topologies = this._topologies.asReadonly();
  readonly allDeployments = this._deployments.asReadonly();

  /** Deployments in scope — what every screen reads. */
  readonly deployments = computed(() => {
    const scope = this.scope();
    const all = this._deployments();
    return scope === 'all' ? all : all.filter((d) => d.projectId === scope);
  });

  readonly activeProject = computed(() => {
    const scope = this.scope();
    return scope === 'all'
      ? null
      : (this._projects().find((p) => p.id === scope) ?? null);
  });

  /** The API's own view of a project, for screens that want it whole. */
  apiProject(id: string): ApiProject | undefined {
    return this.api.projects().find((p) => p.id === id);
  }

  engineersFor(project: Project): Engineer[] {
    return project.engineerIds
      .map((id) => this._engineers().find((e) => e.id === id))
      .filter((e): e is Engineer => e !== undefined);
  }

  deploymentsOf(projectId: string): Deployment[] {
    return this._deployments().filter((d) => d.projectId === projectId);
  }

  riskOf(projectId: string): { eol: number; near: number } {
    const seen = new Set<string>();
    let eol = 0;
    let near = 0;

    for (const deployment of this.deploymentsOf(projectId)) {
      for (const component of deployment.components) {
        const key = `${component.technology}@${component.version}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        const status = this.resolve(component.technology, component.version).status;
        if (status === 'EOL') eol++;
        else if (status === 'NEAR') near++;
      }
    }
    return { eol, near };
  }

  readonly cyclesByUrgency = computed(() =>
    this._cycles()
      .map((cycle) => {
        const days = daysToEol(cycle.eolDate);
        return { cycle, days, status: statusOf(days) };
      })
      .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9)),
  );

  readonly cyclesInUse = computed(() => {
    const inUse = new Set(
      this.deployments().flatMap((d) =>
        d.components.map((c) => `${c.technology}@${c.version}`),
      ),
    );

    return this.cyclesByUrgency().filter(({ cycle }) =>
      cycle.versions.some((v) => inUse.has(`${cycle.technology}@${v}`)),
    );
  });

  deploymentsUsing(cycle: Cycle): Deployment[] {
    return this.deployments().filter((d) =>
      d.components.some(
        (c) => c.technology === cycle.technology && cycle.versions.includes(c.version),
      ),
    );
  }

  resolve(technology: string, version: string): ResolvedComponent {
    const cycle =
      this._cycles().find(
        (c) => c.technology === technology && c.versions.includes(version),
      ) ?? null;
    const days = cycle ? daysToEol(cycle.eolDate) : null;
    return { technology, version, cycle, days, status: statusOf(days) };
  }

  worstStatus(stack: { technology: string; version: string }[]): SupportStatus {
    const order: SupportStatus[] = ['EOL', 'NEAR', 'UNKNOWN', 'SUPPORTED'];
    const found = stack.map((s) => this.resolve(s.technology, s.version).status);
    return order.find((s) => found.includes(s)) ?? 'SUPPORTED';
  }

  actionFor(cycle: Cycle): UpgradeAction | null {
    return (
      this._actions().find(
        (a) =>
          a.technology === cycle.technology &&
          a.cycle === cycle.cycle &&
          a.status !== 'COMPLETED',
      ) ?? null
    );
  }

  readonly inbox = computed<InboxItem[]>(() =>
    this.cyclesInUse()
      .filter(({ status }) => status === 'EOL' || status === 'NEAR')
      .map(({ cycle, days }) => {
        const action = this.actionFor(cycle);
        return {
          kind: action ? 'planned' : 'no-plan',
          cycle,
          days,
          deployments: this.deploymentsUsing(cycle),
          action,
        } satisfies InboxItem;
      }),
  );

  // ---- writes (local until the write API lands) -----------------------------

  saveTechnology(input: Omit<Technology, 'id'> & { id?: string }): Technology {
    const technology: Technology = { ...input, id: input.id ?? newId('t') };
    this._technologies.update((all) =>
      input.id ? all.map((t) => (t.id === input.id ? technology : t)) : [...all, technology],
    );
    return technology;
  }

  deleteTechnology(id: string): string | null {
    const technology = this._technologies().find((t) => t.id === id);
    if (!technology) return 'That technology no longer exists.';

    const users = this._deployments().filter((d) =>
      d.components.some((c) => c.technology === technology.name),
    );
    if (users.length > 0) {
      return `${technology.name} is still installed on ${users.length} environment(s). Remove it there first.`;
    }

    this._technologies.update((all) => all.filter((t) => t.id !== id));
    this._cycles.update((all) => all.filter((c) => c.technology !== technology.name));
    return null;
  }

  saveCycle(input: Omit<Cycle, 'id'> & { id?: string }): Cycle {
    const cycle: Cycle = { ...input, id: input.id ?? newId('c') };
    this._cycles.update((all) =>
      input.id ? all.map((c) => (c.id === input.id ? cycle : c)) : [...all, cycle],
    );
    return cycle;
  }

  deleteCycle(id: string): string | null {
    const cycle = this._cycles().find((c) => c.id === id);
    if (!cycle) return 'That cycle no longer exists.';
    if (this.deploymentsUsing(cycle).length > 0) {
      return `${cycle.technology} ${cycle.cycle} is still deployed. Remove it from those environments first.`;
    }
    this._cycles.update((all) => all.filter((c) => c.id !== id));
    return null;
  }

  saveEngineer(input: Omit<Engineer, 'id'> & { id?: string }): Engineer {
    const engineer: Engineer = { ...input, id: input.id ?? newId('e') };
    this._engineers.update((all) =>
      input.id ? all.map((e) => (e.id === input.id ? engineer : e)) : [...all, engineer],
    );
    return engineer;
  }

  deleteEngineer(id: string): string | null {
    const staffed = this._projects().filter((p) => p.engineerIds.includes(id));
    if (staffed.length > 0) {
      return `Still assigned to ${staffed.length} project(s). Unassign them first.`;
    }
    this._engineers.update((all) => all.filter((e) => e.id !== id));
    return null;
  }

  addProject(input: NewProject): Project {
    const project: Project = {
      id: newId('p'),
      name: input.name,
      customer: input.customer,
      code: input.code.toUpperCase(),
      limeVersion: input.limeVersion,
      status: input.status,
      engineerIds: input.engineerIds,
      startedAt: new Date().toISOString().slice(0, 10),
    };

    const deployments: Deployment[] = input.environments.map((environment) => ({
      id: `${project.id}-${environment.toLowerCase()}`,
      projectId: project.id,
      customer: project.customer,
      customerCode: project.code,
      name: `${project.name} ${environment}`,
      environment,
      location: input.location,
      locationDetail: input.locationDetail,
      limeVersion: project.limeVersion,
      owners: ['DevOps'],
      components: [],
    }));

    this._projects.update((all) => [...all, project]);
    this._deployments.update((all) => [...all, ...deployments]);
    this.scope.set(project.id);
    return project;
  }

  updateProject(id: string, patch: Partial<Project>): void {
    this._projects.update((all) =>
      all.map((p) => (p.id === id ? { ...p, ...patch, id: p.id } : p)),
    );
  }

  deleteProject(id: string): void {
    this._projects.update((all) => all.filter((p) => p.id !== id));
    this._deployments.update((all) => all.filter((d) => d.projectId !== id));
    if (this.scope() === id) {
      this.scope.set('all');
    }
  }

  addEnvironment(
    projectId: string,
    environment: EnvironmentName,
    location: Deployment['location'],
    locationDetail: string,
  ): string | null {
    const project = this._projects().find((p) => p.id === projectId);
    if (!project) return 'That project no longer exists.';
    if (this.deploymentsOf(projectId).some((d) => d.environment === environment)) {
      return `${project.customer} already has a ${environment} environment.`;
    }

    this._deployments.update((all) => [
      ...all,
      {
        id: `${projectId}-${environment.toLowerCase()}`,
        projectId,
        customer: project.customer,
        customerCode: project.code,
        name: `${project.name} ${environment}`,
        environment,
        location,
        locationDetail,
        limeVersion: project.limeVersion,
        owners: ['DevOps'],
        components: [],
      },
    ]);
    return null;
  }

  updateDeployment(id: string, patch: Partial<Deployment>): void {
    this._deployments.update((all) =>
      all.map((d) => (d.id === id ? { ...d, ...patch, id: d.id } : d)),
    );
  }

  deleteDeployment(id: string): void {
    this._deployments.update((all) => all.filter((d) => d.id !== id));
    this._actions.update((all) =>
      all.map((a) => ({ ...a, deploymentIds: a.deploymentIds.filter((x) => x !== id) })),
    );
  }

  saveAction(input: Omit<UpgradeAction, 'id'> & { id?: string }): UpgradeAction {
    const action: UpgradeAction = { ...input, id: input.id ?? newId('act') };
    this._actions.update((all) =>
      input.id ? all.map((a) => (a.id === input.id ? action : a)) : [...all, action],
    );
    return action;
  }

  completeAction(id: string, completedDate: string): void {
    this._actions.update((all) =>
      all.map((a) =>
        a.id === id ? { ...a, status: 'COMPLETED' as const, completedDate } : a,
      ),
    );
  }

  deleteAction(id: string): void {
    this._actions.update((all) => all.filter((a) => a.id !== id));
  }

  // ---- revision history (awaiting a write API) ------------------------------

  readonly changeEvents = computed(() => {
    const out: {
      at: Date;
      kind: ComponentChange['kind'];
      technology: string;
      deploymentId: string;
    }[] = [];

    for (const deployment of this.deployments()) {
      const revisions = this.revisionsFor(deployment.id)
        .slice()
        .sort((a, b) => a.number - b.number);

      for (let i = 1; i < revisions.length; i++) {
        for (const change of summariseChange(
          revisions[i - 1].content,
          revisions[i].content,
        )) {
          out.push({
            at: new Date(revisions[i].createdAt),
            kind: change.kind,
            technology: change.technology,
            deploymentId: deployment.id,
          });
        }
      }
    }
    return out;
  });

  revisionsFor(deploymentId: string): Revision[] {
    return this._revisions()
      .filter((r) => r.deploymentId === deploymentId)
      .sort((a, b) => b.number - a.number);
  }

  parentOf(revision: Revision): Revision | null {
    return (
      this._revisions().find(
        (r) =>
          r.deploymentId === revision.deploymentId && r.number === revision.number - 1,
      ) ?? null
    );
  }

  commit(
    deploymentId: string,
    content: EnvTopology,
    message: string,
    author = 'Platform Admin',
  ): Revision {
    const previous = this.revisionsFor(deploymentId)[0];
    const revision: Revision = {
      id: `${deploymentId}-r${(previous?.number ?? 0) + 1}`,
      deploymentId,
      number: (previous?.number ?? 0) + 1,
      message: message.trim() || 'Update environment',
      author,
      createdAt: new Date().toISOString(),
      content: structuredClone(content),
    };
    this._revisions.update((all) => [...all, revision]);
    this.replaceTopology(content);
    return revision;
  }

  topologyFor(deploymentId: string): EnvTopology | undefined {
    return this._topologies().find((t) => t.deploymentId === deploymentId);
  }

  replaceTopology(next: EnvTopology): void {
    this._topologies.update((all) => {
      const exists = all.some((t) => t.deploymentId === next.deploymentId);
      return exists
        ? all.map((t) => (t.deploymentId === next.deploymentId ? next : t))
        : [...all, next];
    });
  }
}

/** Short unique id for records created in the browser. */
function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}
