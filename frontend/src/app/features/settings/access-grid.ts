import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { AccessChange, AccessLevel, Api, ApiAccessMatrix } from '../../core/api';
import { Feedback } from '../../core/feedback';
import { ROLE_INFO, ROLES, RoleName } from '../../core/permissions';
import { RegistryStore } from '../../core/registry.store';

type Level = AccessLevel | null;
type MatrixUser = ApiAccessMatrix['users'][number];

const RANK: Record<string, number> = { VIEW: 1, EDIT: 2 };

@Component({
  selector: 'lime-access-grid',
  imports: [FormsModule, HlmButton, HlmCardImports, HlmInput],
  host: { class: 'block' },
  template: `
    <section hlmCard class="gap-0 p-0">
      <header class="flex flex-wrap items-center gap-3 border-b px-6 py-4">
        <div class="mr-auto">
          <h2 class="m-0 text-base font-semibold">Project access</h2>
          <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">
            @if (scoped(); as p) {
              Showing <strong class="text-foreground">{{ p.customer }} {{ p.name }}</strong>. Set the project switcher to all projects to see every project.
            } @else {
              Click a cell to switch between no access, View and Edit. Admins always have full access.
            }
          </p>
        </div>
        <input hlmInput type="search" class="h-8 w-[200px] text-[13px]" placeholder="Search people" aria-label="Search people" [ngModel]="query()" (ngModelChange)="query.set($event)" />
        <select hlmInput class="h-8 w-auto py-0 text-[13px]" aria-label="Role" [ngModel]="role()" (ngModelChange)="role.set($event)">
          <option value="">All roles</option>
          @for (r of roles; track r) {
            <option [value]="r">{{ roleInfo[r].label }}</option>
          }
        </select>
        <label class="flex items-center gap-2 text-[13px] text-muted-foreground">
          <input type="checkbox" [checked]="showInactive()" (change)="showInactive.set(!showInactive())" />
          Deactivated
        </label>
      </header>

      @if (!matrix()) {
        <p class="m-0 px-6 py-10 text-center text-muted-foreground">Loading…</p>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-[13px]">
            <thead>
              @if (!scoped()) {
                <tr>
                  <th class="sticky left-0 z-10 bg-card" colspan="3"></th>
                  @for (group of groups(); track group.customerId) {
                    <th class="border-l px-2 pt-3 pb-1 text-left text-[12px] font-semibold" [attr.colspan]="group.projects.length">{{ group.customer }}</th>
                  }
                </tr>
              }
              <tr class="text-muted-foreground">
                <th class="sticky left-0 z-10 min-w-[200px] bg-card px-6 py-2 text-left font-normal">Person</th>
                <th class="px-2 py-2 text-left font-normal">Role</th>
                <th class="px-3 py-2 text-left font-normal" title="Every project, including ones added later">
                  <span class="block text-foreground">All projects</span>
                  <span class="mt-1 flex gap-4 text-[11px]"><span class="w-8 text-center">View</span><span class="w-8 text-center">Edit</span></span>
                </th>
                @for (p of columns(); track p.id) {
                  <th class="border-l px-3 py-2 text-left font-normal">
                    <span class="block text-foreground">{{ p.name }} <span class="text-[11px] text-muted-foreground tabular">{{ p.code }}</span></span>
                    <span class="mt-1 flex gap-4 text-[11px]"><span class="w-8 text-center">View</span><span class="w-8 text-center">Edit</span></span>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (u of rows(); track u.id) {
                <tr class="border-t hover:bg-muted/40" [class.opacity-55]="!u.isActive">
                  <td class="sticky left-0 z-10 bg-card px-6 py-2">
                    <span class="block font-medium">{{ u.name }}</span>
                    <span class="block text-[11.5px] text-muted-foreground">{{ u.email }}</span>
                  </td>
                  <td class="px-2 py-2 whitespace-nowrap">{{ roleInfo[u.role].label }}</td>
                  @if (u.role === 'ADMIN') {
                    <td class="px-3 py-2 text-muted-foreground" [attr.colspan]="columns().length + 1">Admin · full access to everything</td>
                  } @else {
                    <td class="px-3 py-2" [class.changed]="isChanged(u.id, null)">
                      <span class="flex gap-4">
                        <span class="tick"><input type="checkbox" [attr.aria-label]="'View all projects: ' + u.name" [checked]="rank(allOf(u)) >= 1" (change)="toggle(u, null, 'VIEW')" /></span>
                        <span class="tick" [title]="u.role === 'VIEWER' ? 'Viewers cannot edit. Change the role to SRE / DevOps first.' : ''"><input type="checkbox" [attr.aria-label]="'Edit all projects: ' + u.name" [checked]="rank(allOf(u)) >= 2" [disabled]="u.role === 'VIEWER'" (change)="toggle(u, null, 'EDIT')" /></span>
                      </span>
                    </td>
                    @for (p of columns(); track p.id) {
                      @let own = explicitOf(u, p.id);
                      @let via = inherited(u, p.id);
                      <td class="border-l px-3 py-2" [class.changed]="isChanged(u.id, p.id)">
                        <span class="flex gap-4">
                          @for (level of levels; track level) {
                            @let roleBlocked = level === 'EDIT' && u.role === 'VIEWER';
                            @let locked = rank(via?.level) >= rank(level);
                            <span class="tick" [title]="roleBlocked ? 'Viewers cannot edit. Change the role to SRE / DevOps first.' : locked ? 'Given by ' + via?.from + '. Change it there.' : ''">
                              <input
                                type="checkbox"
                                [attr.aria-label]="(level === 'VIEW' ? 'View ' : 'Edit ') + p.name + ': ' + u.name"
                                [checked]="locked || rank(own) >= rank(level)"
                                [disabled]="locked || roleBlocked"
                                (change)="toggle(u, p.id, level)"
                              />
                            </span>
                          }
                        </span>
                        @if (via) {
                          <span class="mt-0.5 block text-[10.5px] text-muted-foreground">{{ via.from }}</span>
                        }
                      </td>
                    }
                  }
                </tr>
              } @empty {
                <tr><td class="px-6 py-8 text-center text-muted-foreground" [attr.colspan]="columns().length + 3">Nobody matches.</td></tr>
              }
            </tbody>
          </table>
        </div>

        <footer class="flex flex-wrap items-center gap-x-5 gap-y-1 border-t px-6 py-3 text-[12px] text-muted-foreground">
          <span><strong class="text-foreground">View</strong> sees the project</span>
          <span><strong class="text-foreground">Edit</strong> changes it, within what the role allows (ticking Edit also ticks View)</span>
          <span>Greyed ticks come from All projects or from being an engineer on the project</span>
        </footer>
      }
    </section>

    @if (pending().size > 0) {
      <div class="sticky bottom-4 z-30 mx-auto mt-4 flex w-fit items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-lg">
        <span class="text-[13px]"><strong>{{ pending().size }}</strong> unsaved change{{ pending().size === 1 ? '' : 's' }}</span>
        <button type="button" hlmBtn variant="ghost" size="sm" (click)="discard()">Discard</button>
        <button type="button" hlmBtn size="sm" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
      </div>
    }
  `,
  styles: `
    .tick {
      display: grid;
      width: 2rem;
      place-items: center;
    }
    .tick input {
      width: 1rem;
      height: 1rem;
      cursor: pointer;
      accent-color: var(--primary);
    }
    .tick input:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
    td.changed {
      background: color-mix(in oklab, var(--primary) 8%, transparent);
    }
  `,
})
export class AccessGrid {
  private readonly api = inject(Api);
  private readonly feedback = inject(Feedback);
  private readonly store = inject(RegistryStore);

  protected readonly roles = ROLES;
  protected readonly roleInfo = ROLE_INFO;
  protected readonly levels: AccessLevel[] = ['VIEW', 'EDIT'];

  protected readonly matrix = signal<ApiAccessMatrix | null>(null);
  protected readonly pending = signal(new Map<string, Level>());
  protected readonly saving = signal(false);
  protected readonly query = signal('');
  protected readonly role = signal<RoleName | ''>('');
  protected readonly showInactive = signal(false);

  protected readonly scoped = computed(() => {
    const active = this.store.activeProject();
    return active ? (this.matrix()?.projects.find((p) => p.id === active.id) ?? null) : null;
  });

  protected readonly columns = computed(() => {
    const scoped = this.scoped();
    return scoped ? [scoped] : (this.matrix()?.projects ?? []);
  });

  protected readonly groups = computed(() => {
    const out: { customerId: string; customer: string; projects: ApiAccessMatrix['projects'] }[] = [];
    for (const p of this.columns()) {
      const last = out.at(-1);
      if (last?.customerId === p.customerId) last.projects.push(p);
      else out.push({ customerId: p.customerId, customer: p.customer, projects: [p] });
    }
    return out;
  });

  protected readonly rows = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const role = this.role();
    return (this.matrix()?.users ?? []).filter(
      (u) =>
        (this.showInactive() || u.isActive) &&
        (!role || u.role === role) &&
        (!needle || `${u.name} ${u.email}`.toLowerCase().includes(needle)),
    );
  });

  constructor() {
    this.api.accessMatrix().subscribe({
      next: (m) => this.matrix.set(m),
      error: (err) => this.feedback.failed(err, 'Could not load project access.'),
    });
  }

  private key(userId: string, projectId: string | null): string {
    return `${userId}|${projectId ?? '*'}`;
  }

  protected isChanged(userId: string, projectId: string | null): boolean {
    return this.pending().has(this.key(userId, projectId));
  }

  protected allOf(u: MatrixUser): Level {
    const k = this.key(u.id, null);
    return this.pending().has(k) ? this.pending().get(k)! : u.allProjects;
  }

  protected explicitOf(u: MatrixUser, projectId: string): Level {
    const k = this.key(u.id, projectId);
    return this.pending().has(k) ? this.pending().get(k)! : (u.access[projectId] ?? null);
  }

  protected inherited(u: MatrixUser, projectId: string): { level: AccessLevel; from: string } | null {
    const staffed = u.staffed[projectId];
    if (staffed) return { level: 'EDIT', from: staffed === 'lead' ? 'project lead' : 'engineer' };
    const all = this.allOf(u);
    return all ? { level: all, from: 'all projects' } : null;
  }

  protected toggle(u: MatrixUser, projectId: string | null, level: AccessLevel): void {
    const current = projectId ? this.explicitOf(u, projectId) : this.allOf(u);
    const ticked = this.rank(current) >= this.rank(level);
    const next: Level = level === 'EDIT' ? (ticked ? 'VIEW' : 'EDIT') : ticked ? null : 'VIEW';
    const original = projectId ? (u.access[projectId] ?? null) : u.allProjects;
    const map = new Map(this.pending());
    const k = this.key(u.id, projectId);
    if (next === original) map.delete(k);
    else map.set(k, next);
    this.pending.set(map);
  }

  protected discard(): void {
    this.pending.set(new Map());
  }

  protected save(): void {
    const changes: AccessChange[] = [...this.pending().entries()].map(([k, level]) => {
      const [userId, projectId] = k.split('|') as [string, string];
      return projectId === '*' ? { userId, level } : { userId, projectId, level };
    });
    this.saving.set(true);
    this.api.saveAccess(changes).subscribe({
      next: (m) => {
        this.saving.set(false);
        this.matrix.set(m);
        this.pending.set(new Map());
        this.feedback.success(`${changes.length} access change${changes.length === 1 ? '' : 's'} saved.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.feedback.failed(err, 'Could not save the access changes.');
      },
    });
  }

  protected rank(level: Level | undefined): number {
    return level ? RANK[level] ?? 0 : 0;
  }

}
