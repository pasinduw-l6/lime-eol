import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatDays, statusFill, statusLabel } from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';
import { Deployment, EnvNode, EnvTopology } from '../../core/models';

const NODE_WIDTH = 210;
const HEADER_HEIGHT = 30;
const ROW_HEIGHT = 22;

interface PlacedNode {
  node: EnvNode;
  height: number;
  worst: string;
  rows: {
    technology: string;
    version: string;
    /** Already formatted for display, e.g. "−681 d". */
    days: string;
    fill: string;
    title: string;
  }[];
}

/**
 * Environment topology.
 *
 * Servers and their installed stack, drawn as a diagram, with every entry
 * resolved against the registry so EOL risk is visible on the machine that
 * carries it. The same topology is editable two ways — on the canvas or as
 * JSON — and both write through one store method, so they cannot disagree.
 */
@Component({
  selector: 'lime-environments',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="flex min-h-screen">
      <!-- environment tree -->
      <aside class="w-[230px] shrink-0 border-r border-rule bg-surface" aria-label="Environments">
        <h1 class="m-0 px-5 pt-5 pb-3 text-[17px] font-semibold">Environments</h1>
        @for (group of grouped(); track group.customer) {
          <div class="border-t border-rule px-5 py-3">
            <h2 class="m-0 mb-1 text-[13px] font-semibold">{{ group.customer }}</h2>
            <ul class="m-0 flex list-none flex-col gap-px p-0">
              @for (d of group.deployments; track d.id) {
                <li>
                  <button
                    type="button"
                    (click)="selectDeployment(d)"
                    class="flex w-full items-center justify-between gap-2 py-1 text-left text-[13px]"
                    [class.font-semibold]="d.id === deployment().id"
                  >
                    <span>{{ d.environment }}</span>
                    <span class="tabular text-[11px]" [style.color]="worstColour(d)">
                      {{ riskCount(d) }}
                    </span>
                  </button>
                </li>
              }
            </ul>
          </div>
        }
      </aside>

      <!-- canvas -->
      <section class="min-w-0 flex-1">
        <header class="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule bg-surface px-6 py-4">
          <div>
            <h2 class="m-0 text-[17px] font-semibold">
              {{ deployment().customer }} · {{ deployment().environment }}
            </h2>
            <p class="m-0 text-[13px] text-ink-soft">
              {{ deployment().location === 'EC2' ? 'AWS' : 'Customer site' }} ·
              {{ deployment().locationDetail }} · Lime {{ deployment().limeVersion }} ·
              owned by {{ deployment().owners.join(' and ') }}
            </p>
          </div>
          <div class="flex gap-2 text-[13px]">
            <button type="button" class="border border-rule px-3 py-1" [class.bg-ground]="mode() === 'visual'" (click)="mode.set('visual')">
              Visual
            </button>
            <button type="button" class="border border-rule px-3 py-1" [class.bg-ground]="mode() === 'json'" (click)="mode.set('json')">
              JSON
            </button>
          </div>
        </header>

        <div class="overflow-auto p-6">
          <svg
            [attr.width]="canvasWidth()" [attr.height]="canvasHeight()"
            role="img"
            [attr.aria-label]="'Topology of ' + deployment().name"
          >
            @for (link of topology().links; track link.from + link.to) {
              <g>
                <line
                  [attr.x1]="linkX1(link.from)" [attr.y1]="linkY(link.from)"
                  [attr.x2]="linkX2(link.to)" [attr.y2]="linkY(link.to)"
                  stroke="var(--color-rule)" stroke-width="1.5"
                />
                @if (link.label) {
                  <text
                    [attr.x]="(linkX1(link.from) + linkX2(link.to)) / 2"
                    [attr.y]="(linkY(link.from) + linkY(link.to)) / 2 - 4"
                    font-size="10" text-anchor="middle" fill="var(--color-ink-soft)"
                  >{{ link.label }}</text>
                }
              </g>
            }

            @for (p of placed(); track p.node.id) {
              <g
                [attr.transform]="'translate(' + p.node.x + ',' + p.node.y + ')'"
                tabindex="0" role="button"
                [attr.aria-label]="p.node.name + ', ' + p.rows.length + ' components'"
                (click)="selectNode(p.node)"
                (keydown.enter)="selectNode(p.node)"
                class="cursor-pointer"
              >
                <rect
                  [attr.width]="NODE_WIDTH" [attr.height]="p.height"
                  fill="var(--color-surface)" stroke="var(--color-rule)"
                  [attr.stroke-width]="selectedNode()?.id === p.node.id ? 2 : 1" rx="3"
                />
                <rect [attr.width]="NODE_WIDTH" height="3" [attr.fill]="p.worst" rx="1" />
                <text x="10" y="21" font-size="13" font-weight="600" fill="var(--color-ink)">
                  {{ p.node.name }}
                </text>
                <text x="10" y="21" font-size="11" fill="var(--color-ink-soft)" [attr.dx]="0" dy="14">
                  {{ p.node.host }}
                </text>

                @for (row of p.rows; track row.technology; let i = $index) {
                  <g [attr.transform]="'translate(0,' + (HEADER_HEIGHT + 16 + i * ROW_HEIGHT) + ')'">
                    <rect x="10" y="4" width="3" height="12" [attr.fill]="row.fill" />
                    <text x="20" y="14" font-size="12" fill="var(--color-ink)">{{ row.technology }}</text>
                    <text x="120" y="14" font-size="11" class="tabular" fill="var(--color-ink-soft)">{{ row.version }}</text>
                    <text
                      [attr.x]="NODE_WIDTH - 10" y="14" font-size="11" text-anchor="end"
                      class="tabular" [attr.fill]="row.fill"
                    >{{ row.days }}</text>
                    <title>{{ row.title }}</title>
                  </g>
                }
              </g>
            }
          </svg>
        </div>
      </section>

      <!-- inspector -->
      <aside class="w-[330px] shrink-0 border-l border-rule bg-surface" aria-label="Details">
        @if (mode() === 'json') {
          <div class="flex h-full flex-col p-5">
            <h2 class="m-0 mb-1 text-[15px] font-semibold">Environment as data</h2>
            <p class="m-0 mb-3 text-[12px] text-ink-soft">
              Edit and apply. This is the shape DevOps commits to the infrastructure repo.
            </p>
            <textarea
              [(ngModel)]="draft"
              spellcheck="false"
              class="tabular h-[430px] w-full resize-none border border-rule bg-ground p-3 text-[11px] leading-[1.45]"
              aria-label="Topology JSON"
            ></textarea>
            @if (error()) {
              <p class="m-0 mt-2 text-[12px] text-overdue" role="alert">{{ error() }}</p>
            }
            <div class="mt-3 flex gap-2 text-[13px]">
              <button type="button" class="border border-ink bg-ink px-3 py-1 text-surface" (click)="applyJson()">
                Apply
              </button>
              <button type="button" class="border border-rule px-3 py-1" (click)="resetJson()">
                Revert
              </button>
            </div>
          </div>
        } @else if (selectedNode(); as node) {
          <div class="p-5">
            <h2 class="m-0 mb-3 text-[15px] font-semibold">{{ node.name }}</h2>
            <label class="mb-3 block text-[12px] text-ink-soft">
              Name
              <input
                class="mt-1 w-full border border-rule px-2 py-1 text-[13px] text-ink"
                [value]="node.name" (change)="rename(node, $event)"
              />
            </label>
            <label class="mb-4 block text-[12px] text-ink-soft">
              Host
              <input
                class="tabular mt-1 w-full border border-rule px-2 py-1 text-[13px] text-ink"
                [value]="node.host ?? ''" (change)="rehost(node, $event)"
              />
            </label>

            <h3 class="m-0 mb-2 text-[13px] font-semibold">Installed</h3>
            <ul class="m-0 flex list-none flex-col gap-2 p-0">
              @for (row of rowsFor(node); track row.technology) {
                <li class="flex items-baseline justify-between gap-2 text-[13px]">
                  <span>{{ row.technology }}</span>
                  <span class="tabular text-ink-soft">{{ row.version }}</span>
                  <span class="tabular w-[64px] text-right" [style.color]="row.fill">{{ row.days }}</span>
                </li>
              }
            </ul>
            <p class="mt-4 mb-0 text-[12px] text-ink-soft">
              Switch to JSON to add or remove components.
            </p>
          </div>
        } @else {
          <div class="p-5 text-[13px] text-ink-soft">
            Select a server to inspect it, or switch to JSON to edit the whole
            environment.
          </div>
        }
      </aside>
    </div>
  `,
})
export class Environments {
  private readonly store = inject(RegistryStore);

  protected readonly NODE_WIDTH = NODE_WIDTH;
  protected readonly HEADER_HEIGHT = HEADER_HEIGHT;
  protected readonly ROW_HEIGHT = ROW_HEIGHT;

  protected readonly mode = signal<'visual' | 'json'>('visual');
  protected readonly deployment = signal<Deployment>(this.store.deployments()[0]);
  protected readonly selectedNode = signal<EnvNode | null>(null);
  protected readonly draft = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly topology = computed<EnvTopology>(
    () =>
      this.store.topologyFor(this.deployment().id) ?? {
        deploymentId: this.deployment().id,
        nodes: [],
        links: [],
      },
  );

  protected readonly grouped = computed(() => {
    const byCustomer = new Map<string, Deployment[]>();
    for (const d of this.store.deployments()) {
      byCustomer.set(d.customer, [...(byCustomer.get(d.customer) ?? []), d]);
    }
    return [...byCustomer].map(([customer, deployments]) => ({
      customer,
      deployments,
    }));
  });

  protected readonly placed = computed<PlacedNode[]>(() =>
    this.topology().nodes.map((node) => ({
      node,
      height: HEADER_HEIGHT + 16 + node.stack.length * ROW_HEIGHT + 8,
      worst: statusFill(this.store.worstStatus(node.stack)),
      rows: this.rowsFor(node),
    })),
  );

  protected readonly canvasWidth = computed(
    () =>
      Math.max(...this.topology().nodes.map((n) => n.x + NODE_WIDTH), 400) + 40,
  );

  protected readonly canvasHeight = computed(
    () =>
      Math.max(
        ...this.placed().map((p) => p.node.y + p.height),
        300,
      ) + 40,
  );

  constructor() {
    // Keep the JSON view in step with whichever environment is selected.
    effect(() => {
      const topology = this.topology();
      this.draft.set(JSON.stringify(topology, null, 2));
    });
  }

  protected rowsFor(node: EnvNode) {
    return node.stack.map((entry) => {
      const resolved = this.store.resolve(entry.technology, entry.version);
      return {
        technology: entry.technology,
        version: entry.version,
        days: formatDays(resolved.days),
        fill: statusFill(resolved.status),
        title: `${entry.technology} ${entry.version} — ${statusLabel(resolved.status)}`,
      };
    });
  }

  protected selectDeployment(d: Deployment): void {
    this.deployment.set(d);
    this.selectedNode.set(null);
    this.error.set(null);
  }

  protected selectNode(node: EnvNode): void {
    this.selectedNode.set(this.selectedNode()?.id === node.id ? null : node);
  }

  /** How many components on this environment are EOL or near it. */
  protected riskCount(d: Deployment): string {
    const at = d.components.filter((c) => {
      const status = this.store.resolve(c.technology, c.version).status;
      return status === 'EOL' || status === 'NEAR';
    }).length;
    return at === 0 ? '' : `${at} at risk`;
  }

  protected worstColour(d: Deployment): string {
    return statusFill(this.store.worstStatus(d.components));
  }

  protected linkX1(id: string): number {
    const node = this.topology().nodes.find((n) => n.id === id);
    return node ? node.x + NODE_WIDTH : 0;
  }

  protected linkX2(id: string): number {
    return this.topology().nodes.find((n) => n.id === id)?.x ?? 0;
  }

  protected linkY(id: string): number {
    const placed = this.placed().find((p) => p.node.id === id);
    return placed ? placed.node.y + placed.height / 2 : 0;
  }

  protected rename(node: EnvNode, event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.updateNode({ ...node, name });
  }

  protected rehost(node: EnvNode, event: Event): void {
    const host = (event.target as HTMLInputElement).value;
    this.updateNode({ ...node, host });
  }

  /** Visual edits write through the same store method as the JSON editor. */
  private updateNode(next: EnvNode): void {
    const topology = this.topology();
    this.store.replaceTopology({
      ...topology,
      nodes: topology.nodes.map((n) => (n.id === next.id ? next : n)),
    });
    this.selectedNode.set(next);
  }

  protected applyJson(): void {
    try {
      const parsed = JSON.parse(this.draft()) as EnvTopology;

      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.links)) {
        throw new Error('A topology needs a "nodes" array and a "links" array.');
      }
      for (const node of parsed.nodes) {
        if (!node.id || !node.name || !Array.isArray(node.stack)) {
          throw new Error(
            `Node "${node.id ?? '(no id)'}" needs an id, a name and a stack array.`,
          );
        }
      }

      this.store.replaceTopology({
        ...parsed,
        deploymentId: this.deployment().id,
      });
      this.error.set(null);
      this.selectedNode.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Invalid JSON.');
    }
  }

  protected resetJson(): void {
    this.draft.set(JSON.stringify(this.topology(), null, 2));
    this.error.set(null);
  }
}
