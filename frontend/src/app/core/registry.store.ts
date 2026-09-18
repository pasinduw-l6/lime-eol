import { Injectable, computed, signal } from '@angular/core';
import { daysToEol, statusOf, SupportStatus } from './lifecycle';
import { CYCLES, DEPLOYMENTS, TOPOLOGIES, UPGRADE_ACTIONS } from './mock-data';
import { Cycle, Deployment, EnvTopology, UpgradeAction } from './models';

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
  private readonly _deployments = signal<Deployment[]>(DEPLOYMENTS);
  private readonly _topologies = signal<EnvTopology[]>(TOPOLOGIES);
  private readonly _actions = signal<UpgradeAction[]>(UPGRADE_ACTIONS);

  readonly cycles = this._cycles.asReadonly();
  readonly deployments = this._deployments.asReadonly();
  readonly topologies = this._topologies.asReadonly();
  readonly actions = this._actions.asReadonly();

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
      this._deployments().flatMap((d) =>
        d.components.map((c) => `${c.technology}@${c.version}`),
      ),
    );

    return this.cyclesByUrgency().filter(({ cycle }) =>
      cycle.versions.some((v) => inUse.has(`${cycle.technology}@${v}`)),
    );
  });

  /** Which deployments run a given cycle — the impact question. */
  deploymentsUsing(cycle: Cycle): Deployment[] {
    return this._deployments().filter((d) =>
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
