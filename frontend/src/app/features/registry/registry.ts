import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatDate, formatDays, statusFill } from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';
import {
  ComponentType,
  Cycle,
  CycleRule,
  Engineer,
  Technology,
} from '../../core/models';
import { Modal } from '../../shared/modal';

const COMPONENT_TYPES: ComponentType[] = [
  'DATABASE',
  'RUNTIME',
  'FRAMEWORK',
  'OS',
  'CONTAINER',
  'ORCHESTRATION',
  'MESSAGING',
  'LIBRARY',
  'OTHER',
];

function blankTechnology(): Omit<Technology, 'id'> & { id?: string } {
  return {
    name: '',
    componentType: 'OTHER',
    vendor: null,
    eolSlug: null,
    cycleRule: 'MAJOR',
    notes: null,
  };
}

function blankCycle(technology: string): Omit<Cycle, 'id'> & { id?: string } {
  return {
    technology,
    componentType: 'OTHER',
    cycle: '',
    label: '',
    releaseDate: null,
    eolDate: null,
    activeSupportEnd: null,
    isLts: false,
    isMaintained: true,
    latestPatch: null,
    eolSource: 'MANUAL',
    versions: [],
  };
}

function blankEngineer(): Omit<Engineer, 'id'> & { id?: string } {
  return { name: '', initials: '', role: 'Engineer' };
}

/**
 * Registry.
 *
 * The reference data everything else hangs off: what technologies we track,
 * the cycles under them — including ones endoflife.date does not publish, so
 * internal components can be tracked the same way — and who is on the team.
 */
@Component({
  selector: 'lime-registry',
  imports: [FormsModule, Modal],
  host: { class: 'block' },
  template: `
    <section class="card mb-5 flex flex-wrap items-start justify-between gap-4 px-7 py-6">
      <div>
        <h1 class="m-0 text-[30px] font-semibold tracking-[-0.02em]">Registry</h1>
        <p class="m-0 text-[14px] text-ink-soft">
          {{ technologies().length }} technologies · {{ cycleCount() }} cycles ·
          {{ engineers().length }} engineers
        </p>
      </div>
      <div class="flex gap-2">
        <button type="button" class="btn" (click)="engineerDraft.set(newEngineer())">
          Add engineer
        </button>
        <button type="button" class="btn btn-primary" (click)="techDraft.set(newTechnology())">
          Add technology
        </button>
      </div>
    </section>

    @if (error(); as message) {
      <p class="card mb-5 px-7 py-4 text-[14px] text-overdue" role="alert">{{ message }}</p>
    }

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <!-- technologies -->
      <section class="card overflow-hidden">
        <header class="border-b border-rule px-6 py-4">
          <h2 class="m-0 text-[15px] font-semibold">Technologies</h2>
        </header>

        @for (row of rows(); track row.technology.id) {
          <article class="border-b border-rule last:border-b-0">
            <div class="flex flex-wrap items-center gap-3 px-6 py-3">
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                (click)="expanded.set(expanded() === row.technology.id ? null : row.technology.id)"
                [attr.aria-expanded]="expanded() === row.technology.id"
              >
                <span class="block text-[14px] font-medium">
                  {{ row.technology.name }}
                  <span class="text-[12px] text-ink-soft">
                    · {{ row.technology.componentType.toLowerCase() }}
                  </span>
                </span>
                <span class="tabular block text-[12px] text-ink-soft">
                  {{ row.cycles.length }} cycles ·
                  {{ row.technology.eolSlug || 'manual only' }} ·
                  {{ row.technology.cycleRule.toLowerCase().replace('_', '.') }}
                </span>
              </button>

              @if (row.atRisk > 0) {
                <span class="tabular text-[12px] text-overdue">{{ row.atRisk }} at risk</span>
              }
              <span class="flex gap-2 text-[12px]">
                <button type="button" class="text-accent-bright" (click)="editTechnology(row.technology)">Edit</button>
                <button type="button" class="text-overdue" (click)="removeTechnology(row.technology)">Delete</button>
              </span>
            </div>

            @if (expanded() === row.technology.id) {
              <div class="border-t border-rule bg-elevated/40 px-6 py-4">
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="m-0 text-[13px] font-semibold">Cycles</h3>
                  <button
                    type="button"
                    class="text-[12px] text-accent-bright"
                    (click)="cycleDraft.set(newCycle(row.technology))"
                  >
                    Add cycle by hand
                  </button>
                </div>
                <table class="w-full border-collapse text-[13px]">
                  <thead>
                    <tr class="text-left text-[11px] text-ink-soft">
                      <th class="py-1 pr-3 font-medium">Cycle</th>
                      <th class="py-1 pr-3 font-medium">Versions</th>
                      <th class="py-1 pr-3 font-medium">Ends</th>
                      <th class="py-1 pr-3 font-medium">Source</th>
                      <th class="py-1 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of row.cycles; track c.cycle.id) {
                      <tr class="border-t border-rule">
                        <td class="tabular py-1.5 pr-3">{{ c.cycle.cycle }}</td>
                        <td class="tabular py-1.5 pr-3 text-ink-soft">
                          {{ c.cycle.versions.join(', ') || '—' }}
                        </td>
                        <td class="tabular py-1.5 pr-3" [style.color]="c.colour">
                          {{ date(c.cycle.eolDate) }}
                          <span class="text-[11px]">({{ days(c.days) }})</span>
                        </td>
                        <td class="py-1.5 pr-3 text-[11px] text-ink-soft">
                          {{ c.cycle.eolSource === 'API' ? 'endoflife.date' : 'entered by hand' }}
                        </td>
                        <td class="py-1.5 text-right">
                          <span class="flex justify-end gap-2 text-[12px]">
                            <button type="button" class="text-accent-bright" (click)="editCycle(c.cycle)">Edit</button>
                            <button type="button" class="text-overdue" (click)="removeCycle(c.cycle)">Delete</button>
                          </span>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5" class="py-3 text-ink-soft">
                          No cycles yet. Sync from endoflife.date or add one by hand.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </article>
        }
      </section>

      <!-- team -->
      <section class="card overflow-hidden">
        <header class="border-b border-rule px-6 py-4">
          <h2 class="m-0 text-[15px] font-semibold">Team</h2>
        </header>
        <ul class="m-0 list-none p-0">
          @for (e of engineers(); track e.id) {
            <li class="flex items-center gap-3 border-b border-rule px-6 py-3 last:border-b-0">
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-deep text-[11px]">
                {{ e.initials }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[14px]">{{ e.name }}</span>
                <span class="block text-[12px] text-ink-soft">
                  {{ e.role }} · {{ projectCount(e.id) }} project(s)
                </span>
              </span>
              <span class="flex gap-2 text-[12px]">
                <button type="button" class="text-accent-bright" (click)="engineerDraft.set({ ...e })">Edit</button>
                <button type="button" class="text-overdue" (click)="removeEngineer(e)">Delete</button>
              </span>
            </li>
          }
        </ul>
      </section>
    </div>

    <!-- technology form -->
    @if (techDraft(); as form) {
      <lime-modal
        [title]="form.id ? 'Edit technology' : 'Add technology'"
        subtitle="Anything the platform depends on, whether or not endoflife.date tracks it."
        (dismiss)="techDraft.set(null)"
      >
        <form class="grid gap-4" (submit)="saveTechnology($event)">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="field">
              Name
              <input class="input" [(ngModel)]="form.name" name="name" placeholder="Redis" />
            </label>
            <label class="field">
              Type
              <select class="input" [(ngModel)]="form.componentType" name="type">
                @for (t of componentTypes; track t) {
                  <option [value]="t">{{ t.toLowerCase() }}</option>
                }
              </select>
            </label>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="field">
              Vendor
              <input class="input" [(ngModel)]="form.vendor" name="vendor" placeholder="Redis Ltd" />
            </label>
            <label class="field">
              endoflife.date slug
              <input class="input tabular" [(ngModel)]="form.eolSlug" name="slug" placeholder="redis" />
            </label>
          </div>
          <label class="field">
            Cycle rule
            <select class="input" [(ngModel)]="form.cycleRule" name="rule">
              <option value="MAJOR">MAJOR — 20.11.1 becomes 20</option>
              <option value="MAJOR_MINOR">MAJOR_MINOR — 6.0.14 becomes 6.0</option>
            </select>
          </label>
          <label class="field">
            Notes
            <input class="input" [(ngModel)]="form.notes" name="notes" />
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" (click)="techDraft.set(null)">Cancel</button>
            <button type="submit" class="btn btn-primary">
              {{ form.id ? 'Save changes' : 'Add technology' }}
            </button>
          </div>
        </form>
      </lime-modal>
    }

    <!-- cycle form -->
    @if (cycleDraft(); as form) {
      <lime-modal
        [title]="form.id ? 'Edit cycle' : 'Add cycle by hand'"
        [subtitle]="form.technology + ' — entered manually, so the sync will never overwrite it.'"
        (dismiss)="cycleDraft.set(null)"
      >
        <form class="grid gap-4" (submit)="saveCycle($event)">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="field">
              Cycle
              <input class="input tabular" [(ngModel)]="form.cycle" name="cycle" placeholder="7.2" />
            </label>
            <label class="field">
              Versions in use (comma separated)
              <input class="input tabular" [(ngModel)]="versionsText" name="versions" placeholder="7.2.4, 7.2.1" />
            </label>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <label class="field">
              Released
              <input type="date" class="input" [(ngModel)]="form.releaseDate" name="released" />
            </label>
            <label class="field">
              Active support ends
              <input type="date" class="input" [(ngModel)]="form.activeSupportEnd" name="active" />
            </label>
            <label class="field">
              End of life
              <input type="date" class="input" [(ngModel)]="form.eolDate" name="eol" />
            </label>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" (click)="cycleDraft.set(null)">Cancel</button>
            <button type="submit" class="btn btn-primary">
              {{ form.id ? 'Save changes' : 'Add cycle' }}
            </button>
          </div>
        </form>
      </lime-modal>
    }

    <!-- engineer form -->
    @if (engineerDraft(); as form) {
      <lime-modal
        [title]="form.id ? 'Edit engineer' : 'Add engineer'"
        subtitle="People who can be assigned to projects and upgrade actions."
        (dismiss)="engineerDraft.set(null)"
      >
        <form class="grid gap-4" (submit)="saveEngineer($event)">
          <label class="field">
            Name
            <input class="input" [(ngModel)]="form.name" name="name" (change)="deriveInitials()" />
          </label>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="field">
              Initials
              <input class="input" [(ngModel)]="form.initials" name="initials" maxlength="3" />
            </label>
            <label class="field">
              Role
              <select class="input" [(ngModel)]="form.role" name="role">
                <option value="Engineer">Engineer</option>
                <option value="Lead">Lead</option>
              </select>
            </label>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" (click)="engineerDraft.set(null)">Cancel</button>
            <button type="submit" class="btn btn-primary">
              {{ form.id ? 'Save changes' : 'Add engineer' }}
            </button>
          </div>
        </form>
      </lime-modal>
    }
  `,
})
export class Registry {
  private readonly store = inject(RegistryStore);

  protected readonly componentTypes = COMPONENT_TYPES;
  protected readonly technologies = this.store.technologies;
  protected readonly engineers = this.store.engineers;

  protected readonly expanded = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly techDraft = signal<(Omit<Technology, 'id'> & { id?: string }) | null>(null);
  protected readonly cycleDraft = signal<(Omit<Cycle, 'id'> & { id?: string }) | null>(null);
  protected readonly engineerDraft = signal<(Omit<Engineer, 'id'> & { id?: string }) | null>(null);
  protected readonly versionsText = signal('');

  protected readonly cycleCount = computed(() => this.store.cycles().length);

  protected readonly rows = computed(() =>
    this.technologies().map((technology) => {
      const cycles = this.store
        .cyclesByUrgency()
        .filter((c) => c.cycle.technology === technology.name)
        .map((c) => ({ ...c, colour: statusFill(c.status) }));

      return {
        technology,
        cycles,
        atRisk: this.store
          .cyclesInUse()
          .filter(
            (c) =>
              c.cycle.technology === technology.name &&
              (c.status === 'EOL' || c.status === 'NEAR'),
          ).length,
      };
    }),
  );

  protected projectCount(engineerId: string): number {
    return this.store.projects().filter((p) => p.engineerIds.includes(engineerId)).length;
  }

  protected newTechnology = blankTechnology;
  protected newEngineer = blankEngineer;

  protected newCycle(technology: Technology) {
    this.versionsText.set('');
    return { ...blankCycle(technology.name), componentType: technology.componentType };
  }

  protected editTechnology(technology: Technology): void {
    this.error.set(null);
    this.techDraft.set({ ...technology });
  }

  protected editCycle(cycle: Cycle): void {
    this.versionsText.set(cycle.versions.join(', '));
    this.cycleDraft.set({ ...cycle });
  }

  protected saveTechnology(event: Event): void {
    event.preventDefault();
    const form = this.techDraft();
    if (!form?.name.trim()) {
      this.error.set('A technology needs a name.');
      return;
    }
    this.store.saveTechnology(form);
    this.techDraft.set(null);
    this.error.set(null);
  }

  protected saveCycle(event: Event): void {
    event.preventDefault();
    const form = this.cycleDraft();
    if (!form?.cycle.trim()) {
      return;
    }
    this.store.saveCycle({
      ...form,
      label: form.label || form.cycle,
      eolSource: 'MANUAL',
      versions: this.versionsText()
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    });
    this.cycleDraft.set(null);
  }

  protected saveEngineer(event: Event): void {
    event.preventDefault();
    const form = this.engineerDraft();
    if (!form?.name.trim()) {
      return;
    }
    this.store.saveEngineer({ ...form, initials: form.initials || initials(form.name) });
    this.engineerDraft.set(null);
  }

  protected deriveInitials(): void {
    const form = this.engineerDraft();
    if (form && !form.initials) {
      form.initials = initials(form.name);
    }
  }

  protected removeTechnology(technology: Technology): void {
    this.error.set(this.store.deleteTechnology(technology.id));
  }

  protected removeCycle(cycle: Cycle): void {
    this.error.set(this.store.deleteCycle(cycle.id));
  }

  protected removeEngineer(engineer: Engineer): void {
    this.error.set(this.store.deleteEngineer(engineer.id));
  }

  protected date = formatDate;
  protected days = formatDays;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
