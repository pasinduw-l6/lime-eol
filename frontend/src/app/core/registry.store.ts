import { Injectable, computed, signal } from '@angular/core';
import { daysToEol, statusOf, SupportStatus } from './lifecycle';
import { CYCLES, UPGRADE_ACTIONS } from './mock-data';
import {
  ALL_DEPLOYMENTS,
  ALL_TOPOLOGIES,
  ENGINEERS,
  PROJECTS,
  buildDeployment,
  buildTopology,
} from './projects.mock';
import {
  Cycle,
  Deployment,
  Engineer,
  EnvTopology,
  EnvironmentName,
  Project,
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

/** A technology+version resolved against the registry. */
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

@Injectable({ providedIn: 'root' })
export class RegistryStore {
  private readonly _cycles = signal<Cycle[]>(CYCLES);
  private readonly _deployments = signal<Deployment[]>(ALL_DEPLOYMENTS);
  private readonly _topologies = signal<EnvTopology[]>(ALL_TOPOLOGIES);
  private readonly _actions = signal<UpgradeAction[]>(UPGRADE_ACTIONS);
  private readonly _projects = signal<Project[]>(PROJECTS);

  /**
   * The project the app is scoped to. Every derived list below respects it, so
   * switching project re-scopes the whole application from one signal.
   */
  readonly scope = signal<ProjectScope>('all');

  readonly cycles = this._cycles.asReadonly();
  readonly topologies = this._topologies.asReadonly();
  readonly actions = this._actions.asReadonly();
  readonly projects = this._projects.asReadonly();
  readonly engineers = signal<Engineer[]>(ENGINEERS).asReadonly();

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

  engineersFor(project: Project): Engineer[] {
    return project.engineerIds
      .map((id) => this.engineers().find((e) => e.id === id))
      .filter((e): e is Engineer => e !== undefined);
  }

  /** Deployments belonging to a project, regardless of current scope. */
  deploymentsOf(projectId: string): Deployment[] {
    return this._deployments().filter((d) => d.projectId === projectId);
  }

  /** How many components in a project are at or near end of life. */
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
        if (status === 'EOL') {
          eol++;
        } else if (status === 'NEAR') {
          near++;
        }
      }
    }
    return { eol, near };
  }

  /**
   * Creates a project and the environments it starts with, each inheriting the
   * component set of its Lime release.
   */
  addProject(input: NewProject): Project {
    const id = `${input.code.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}`;
    const project: Project = {
      id,
      name: input.name,
      customer: input.customer,
      code: input.code.toUpperCase(),
      limeVersion: input.limeVersion,
      status: input.status,
      engineerIds: input.engineerIds,
      startedAt: new Date().toISOString().slice(0, 10),
    };

    const deployments = input.environments.map((env) =>
      buildDeployment(project, env, input.location, input.locationDetail),
    );

    this._projects.update((all) => [...all, project]);
    this._deployments.update((all) => [...all, ...deployments]);
    this._topologies.update((all) => [...all, ...deployments.map(buildTopology)]);
    this.scope.set(project.id);

    return project;
  }

  /** Cycle plus computed lifecycle state, sorted most urgent first. */
  readonly cyclesByUrgency = computed(() =>
    this._cycles()
      .map((cycle) => {
        const days = daysToEol(cycle.eolDate);
        return { cycle, days, status: statusOf(days) };
      })
      .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9)),
  );

  /** Only cycles actually deployed somewhere count as risk. */
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

  /** Which deployments run a given cycle — the impact question. */
  deploymentsUsing(cycle: Cycle): Deployment[] {
    return this.deployments().filter((d) =>
      d.components.some(
        (c) =>
          c.technology === cycle.technology && cycle.versions.includes(c.version),
      ),
    );
  }

  /** Resolves a stack entry on a topology node against the registry. */
  resolve(technology: string, version: string): ResolvedComponent {
    const cycle =
      this._cycles().find(
        (c) => c.technology === technology && c.versions.includes(version),
      ) ?? null;
    const days = cycle ? daysToEol(cycle.eolDate) : null;

    return { technology, version, cycle, days, status: statusOf(days) };
  }

  /** Worst status among a node's stack — what the node header reports. */
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

  /** "Needs you": in-use cycles at or near EOL, worst first. */
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

  topologyFor(deploymentId: string): EnvTopology | undefined {
    return this._topologies().find((t) => t.deploymentId === deploymentId);
  }

  /**
   * Replaces one environment's topology — used by both the JSON editor and
   * direct canvas edits, so the two views can never disagree.
   */
  replaceTopology(next: EnvTopology): void {
    this._topologies.update((all) =>
      all.map((t) => (t.deploymentId === next.deploymentId ? next : t)),
    );
  }
}
