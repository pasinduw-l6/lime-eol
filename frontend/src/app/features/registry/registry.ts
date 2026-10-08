import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiCatalogueProduct } from '../../core/api';
import { formatDate, formatDays, statusFill } from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';
import { ComponentType, Cycle, CycleRule, Technology } from '../../core/models';
import { Modal } from '../../shared/modal';
import { TechIcon } from '../../shared/tech-icon';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';

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

@Component({
  selector: 'lime-registry',
  imports: [HlmAlertImports, HlmCardImports, HlmButton, HlmInput, HlmLabel, HlmTableImports, FormsModule, Modal, TechIcon],
  host: { class: 'block' },
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-3xl font-semibold tracking-tight">Registry</h1>
        <p class="m-0 mt-1 text-sm text-muted-foreground">
          {{ technologies().length }} technologies · {{ cycleCount() }} cycles ·
          {{ engineers().length }} engineers
        </p>
      </div>
      <button type="button" hlmBtn (click)="openCatalogue()">
        Add technology
      </button>
    </header>

    @if (error(); as message) {
      <p hlmAlert variant="destructive" class="mb-5">{{ message }}</p>
    }

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section hlmCard class="block overflow-hidden py-0">
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
                <button type="button" class="text-primary" (click)="editTechnology(row.technology)">Edit</button>
                <button type="button" class="text-overdue" (click)="removeTechnology(row.technology)">Delete</button>
              </span>
            </div>

            @if (expanded() === row.technology.id) {
              <div class="border-t border-rule bg-elevated/40 px-6 py-4">
                <div class="mb-3 flex items-center justify-between">
                  <h3 class="m-0 text-[13px] font-semibold">Cycles</h3>
                  <button
                    type="button"
                    class="text-[12px] text-primary"
                    (click)="cycleDraft.set(newCycle(row.technology))"
                  >
                    Add cycle by hand
                  </button>
                </div>
                <table hlmTable class="w-full border-collapse text-[13px]">
                  <thead hlmTHead>
                    <tr hlmTr class="text-left text-[11px] text-ink-soft">
                      <th hlmTh class="py-1 pr-3 font-medium">Cycle</th>
                      <th hlmTh class="py-1 pr-3 font-medium">Versions</th>
                      <th hlmTh class="py-1 pr-3 font-medium">Ends</th>
                      <th hlmTh class="py-1 pr-3 font-medium">Source</th>
                      <th hlmTh class="py-1 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody hlmTBody>
                    @for (c of row.cycles; track c.cycle.id) {
                      <tr hlmTr class="border-t border-rule">
                        <td hlmTd class="whitespace-normal tabular py-1.5 pr-3">{{ c.cycle.cycle }}</td>
                        <td hlmTd class="whitespace-normal tabular py-1.5 pr-3 text-ink-soft">
                          {{ c.cycle.versions.join(', ') || '—' }}
                        </td>
                        <td hlmTd class="whitespace-normal tabular py-1.5 pr-3" [style.color]="c.colour">
                          {{ date(c.cycle.eolDate) }}
                          <span class="text-[11px]">({{ days(c.days) }})</span>
                        </td>
                        <td hlmTd class="whitespace-normal py-1.5 pr-3 text-[11px] text-ink-soft">
                          {{ c.cycle.eolSource === 'API' ? 'endoflife.date' : 'entered by hand' }}
                        </td>
                        <td hlmTd class="whitespace-normal py-1.5 text-right">
                          <span class="flex justify-end gap-2 text-[12px]">
                            <button type="button" class="text-primary" (click)="editCycle(c.cycle)">Edit</button>
                            <button type="button" class="text-overdue" (click)="removeCycle(c.cycle)">Delete</button>
                          </span>
                        </td>
                      </tr>
                    } @empty {
                      <tr hlmTr>
                        <td hlmTd colspan="5" class="py-3 text-ink-soft">
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

      <section hlmCard class="block overflow-hidden py-0">
        <header class="border-b border-rule px-6 py-4">
          <h2 class="m-0 text-[15px] font-semibold">Team</h2>
          <p class="m-0 text-[12px] text-ink-soft">
            Accounts are issued by an administrator. Assign people to work on
            the <span class="text-ink">Projects</span> screen.
          </p>
        </header>
        <ul class="m-0 list-none p-0">
          @for (e of engineers(); track e.id) {
            <li class="flex items-center gap-3 border-b border-rule px-6 py-3 last:border-b-0">
              <span
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px]"
                [class.brand-gradient]="e.canEdit"
                [style.background]="e.canEdit ? null : 'var(--color-elevated)'"
                [style.color]="e.canEdit ? null : 'var(--color-ink-soft)'"
              >
                {{ e.initials }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[14px]">{{ e.name }}</span>
                <span class="block truncate text-[12px] text-ink-soft">{{ e.email }}</span>
              </span>
              <span class="shrink-0 text-right text-[12px] text-ink-soft">
                <span class="block">{{ e.canEdit ? 'Engineer' : 'Read only' }}</span>
                <span class="tabular block text-ink-faint">
                  {{ projectCount(e.id) }} project{{ projectCount(e.id) === 1 ? '' : 's' }}
                </span>
              </span>
            </li>
          } @empty {
            <li class="px-6 py-6 text-center text-[13px] text-ink-soft">
              No accounts yet.
            </li>
          }
        </ul>
      </section>
    </div>

    @if (catalogueOpen()) {
      <lime-modal
        title="Add technology"
        subtitle="Anything endoflife.date tracks. Its cycles and dates come with it."
        (dismiss)="closeCatalogue()"
      >
        @if (chosen(); as product) {
          <div class="grid gap-4">
            <div class="flex items-center gap-3 rounded-xl border border-rule bg-elevated px-4 py-3">
              <lime-tech-icon
                [technology]="product.label"
                [iconSlug]="product.iconSlug"
                [iconColour]="product.iconColour"
                [componentType]="product.suggestedType"
                [size]="36"
              />
              <div class="min-w-0 flex-1">
                <p class="m-0 text-[16px] font-semibold">{{ product.label }}</p>
                <p class="tabular m-0 text-[12px] text-ink-soft">
                  {{ product.slug }} · {{ product.category }}
                </p>
              </div>
              <button type="button" hlmBtn variant="outline" (click)="chosen.set(null)">Change</button>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Name in this registry
                <input hlmInput [(ngModel)]="draftName" name="dname" />
              </label>
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Type
                <select hlmInput [(ngModel)]="draftType" name="dtype">
                  @for (t of componentTypes; track t) {
                    <option [value]="t">{{ t.toLowerCase() }}</option>
                  }
                </select>
              </label>
            </div>

            <p class="m-0 text-[11.5px] text-ink-faint">
              Type and cycle rule were read from the product. Change them only if
              they are wrong for how you run it.
            </p>

            @if (error()) {
              <p class="m-0 text-[13px] text-overdue" role="alert">{{ error() }}</p>
            }

            <div class="flex justify-end gap-2">
              <button type="button" hlmBtn variant="outline" (click)="closeCatalogue()">Cancel</button>
              <button
                type="button"
                hlmBtn
                [disabled]="saving()"
                (click)="addFromCatalogue(product)"
              >
                {{ saving() ? 'Importing cycles…' : 'Add ' + draftName() }}
              </button>
            </div>
          </div>
        } @else {
          <div class="grid gap-3">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Search {{ api.catalogue().length }} tracked products
              <input
                hlmInput
                [(ngModel)]="catalogueQuery"
                name="catq"
                placeholder="redis, kafka, rhel, tomcat…"
                autocomplete="off"
              />
            </label>

            <div class="flex flex-wrap gap-1.5">
              @for (c of categories(); track c) {
                <button
                  type="button"
                  class="glass rounded-md border px-3 py-1 text-[12px]"
                  [class.border-primary]="category() === c"
                  [class.text-primary]="category() === c"
                  [class.border-rule]="category() !== c"
                  [class.text-ink-soft]="category() !== c"
                  (click)="category.set(category() === c ? null : c)"
                >
                  {{ c }}
                </button>
              }
            </div>

            @if (api.catalogueResource.isLoading()) {
              <p class="m-0 py-6 text-center text-[13px] text-ink-soft">
                Loading the catalogue…
              </p>
            } @else {
              <ul class="scroll-hidden m-0 grid max-h-[46vh] list-none gap-1 overflow-y-auto p-0">
                @for (product of matches(); track product.slug) {
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left disabled:opacity-45"
                      [class.hover:bg-elevated]="!product.registeredAs"
                      [disabled]="!!product.registeredAs"
                      (click)="choose(product)"
                    >
                      <lime-tech-icon
                        [technology]="product.label"
                        [iconSlug]="product.iconSlug"
                        [iconColour]="product.iconColour"
                        [componentType]="product.suggestedType"
                        [size]="24"
                      />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[14px]">{{ product.label }}</span>
                        <span class="tabular block truncate text-[11.5px] text-ink-faint">
                          {{ product.slug }}
                        </span>
                      </span>
                      <span class="shrink-0 text-[11.5px] text-ink-soft">
                        {{
                          product.registeredAs
                            ? 'added as ' + product.registeredAs
                            : product.suggestedType.toLowerCase()
                        }}
                      </span>
                    </button>
                  </li>
                } @empty {
                  <li class="py-6 text-center text-[13px] text-ink-soft">
                    Nothing in the catalogue matches. endoflife.date does not
                    track it, so its dates would have to be entered by hand.
                  </li>
                }
              </ul>
            }
          </div>
        }
      </lime-modal>
    }

    @if (techDraft(); as form) {
      <lime-modal
        title="Edit technology"
        [subtitle]="form.eolSlug ? 'Tracking ' + form.eolSlug + ' on endoflife.date' : 'Not tracked upstream'"
        (dismiss)="techDraft.set(null)"
      >
        <form class="grid gap-4" (submit)="saveTechnology($event)">
          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Name
              <input hlmInput [(ngModel)]="form.name" name="name" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Type
              <select hlmInput [(ngModel)]="form.componentType" name="type">
                @for (t of componentTypes; track t) {
                  <option [value]="t">{{ t.toLowerCase() }}</option>
                }
              </select>
            </label>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Scope
              <select hlmInput [(ngModel)]="form.scope" name="scope">
                <option value="INFRASTRUCTURE">Infrastructure component</option>
                <option value="APPLICATION">Application dependency</option>
              </select>
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Vendor
              <input hlmInput [(ngModel)]="form.vendor" name="vendor" />
            </label>
          </div>
          <p class="m-0 -mt-2 text-[12px] text-muted-foreground">
            Scope decides who covers an upgrade: infrastructure under the subscription,
            application dependencies through Lime releases.
          </p>
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Cycle rule
            <select hlmInput [(ngModel)]="form.cycleRule" name="rule">
              <option value="MAJOR">MAJOR — 20.11.1 becomes 20</option>
              <option value="MAJOR_MINOR">MAJOR_MINOR — 6.0.14 becomes 6.0</option>
            </select>
          </label>
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Notes
            <input hlmInput [(ngModel)]="form.notes" name="notes" />
          </label>

          @if (error()) {
            <p class="m-0 text-[13px] text-overdue" role="alert">{{ error() }}</p>
          }

          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="techDraft.set(null)">Cancel</button>
            <button type="submit" hlmBtn>Save changes</button>
          </div>
        </form>
      </lime-modal>
    }

    @if (cycleDraft(); as form) {
      <lime-modal
        [title]="form.id ? 'Edit cycle' : 'Add cycle by hand'"
        [subtitle]="form.technology + ' — entered manually, so the sync will never overwrite it.'"
        (dismiss)="cycleDraft.set(null)"
      >
        <form class="grid gap-4" (submit)="saveCycle($event)">
          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Cycle
              <input hlmInput class="tabular" [(ngModel)]="form.cycle" name="cycle" placeholder="7.2" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Versions in use (comma separated)
              <input hlmInput class="tabular" [(ngModel)]="versionsText" name="versions" placeholder="7.2.4, 7.2.1" />
            </label>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Released
              <input type="date" hlmInput [(ngModel)]="form.releaseDate" name="released" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Active support ends
              <input type="date" hlmInput [(ngModel)]="form.activeSupportEnd" name="active" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              End of life
              <input type="date" hlmInput [(ngModel)]="form.eolDate" name="eol" />
            </label>
          </div>
          @if (error()) {
            <p class="m-0 text-[13px] text-overdue" role="alert">{{ error() }}</p>
          }
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="cycleDraft.set(null)">Cancel</button>
            <button type="submit" hlmBtn>
              {{ form.id ? 'Save changes' : 'Add cycle' }}
            </button>
          </div>
        </form>
      </lime-modal>
    }

  `,
})
export class Registry {
  private readonly store = inject(RegistryStore);
  protected readonly api = inject(Api);

  protected readonly componentTypes = COMPONENT_TYPES;
  protected readonly technologies = this.store.technologies;
  protected readonly engineers = this.store.engineers;

  protected readonly expanded = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly techDraft = signal<(Omit<Technology, 'id'> & { id?: string }) | null>(null);
  protected readonly cycleDraft = signal<(Omit<Cycle, 'id'> & { id?: string }) | null>(null);
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


  protected readonly catalogueOpen = signal(false);
  protected readonly catalogueQuery = signal('');
  protected readonly category = signal<string | null>(null);
  protected readonly chosen = signal<ApiCatalogueProduct | null>(null);
  protected readonly draftName = signal('');
  protected readonly draftType = signal<ComponentType>('OTHER');
  protected readonly saving = signal(false);

  protected readonly categories = computed(() =>
    [...new Set(this.api.catalogue().map((p) => p.category))].sort(),
  );

  protected readonly matches = computed(() => {
    const term = this.catalogueQuery().trim().toLowerCase();
    const category = this.category();

    return this.api
      .catalogue()
      .filter((p) => !category || p.category === category)
      .filter(
        (p) =>
          !term ||
          p.slug.includes(term) ||
          p.label.toLowerCase().includes(term) ||
          p.aliases.some((alias) => alias.toLowerCase().includes(term)),
      )
      .slice(0, 120);
  });

  protected openCatalogue(): void {
    this.error.set(null);
    this.chosen.set(null);
    this.catalogueQuery.set('');
    this.category.set(null);
    this.catalogueOpen.set(true);
  }

  protected closeCatalogue(): void {
    this.catalogueOpen.set(false);
    this.chosen.set(null);
    this.error.set(null);
  }

  protected choose(product: ApiCatalogueProduct): void {
    this.draftName.set(product.label);
    this.draftType.set(product.suggestedType as ComponentType);
    this.chosen.set(product);
  }

  protected addFromCatalogue(product: ApiCatalogueProduct): void {
    this.error.set(null);
    this.saving.set(true);

    this.api
      .createTechnology({
        slug: product.slug,
        name: this.draftName().trim() || product.label,
        componentType: this.draftType(),
      })
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.closeCatalogue();
          this.error.set(
            created.cycles.length === 0
              ? `${created.name} was added, but no cycles came back. Add one by hand so its end-of-life date is known.`
              : null,
          );
          this.api.reload();
        },
        error: (err: { error?: { message?: string | string[] } }) => {
          this.saving.set(false);
          const message = err.error?.message;
          this.error.set(
            Array.isArray(message)
              ? message.join('. ')
              : (message ?? 'Could not add that technology.'),
          );
        },
      });
  }

  protected saveTechnology(event: Event): void {
    event.preventDefault();
    const form = this.techDraft();

    if (!form?.name.trim()) {
      this.error.set('A technology needs a name.');
      return;
    }

    if (!form.id) {
      return;
    }

    this.saving.set(true);
    this.api
      .updateTechnology(form.id, {
        name: form.name.trim(),
        componentType: form.componentType,
        scope: form.scope,
        vendor: form.vendor ?? '',
        cycleRule: form.cycleRule,
        notes: form.notes ?? '',
      })
      .subscribe(this.done(() => this.techDraft.set(null), 'That technology could not be saved.'));
  }

  protected saveCycle(event: Event): void {
    event.preventDefault();
    const form = this.cycleDraft();
    if (!form?.cycle.trim()) {
      this.error.set('A cycle needs a name, such as 7.2.');
      return;
    }

    const body = {
      cycle: form.cycle.trim(),
      releaseDate: form.releaseDate || null,
      activeSupportEnd: form.activeSupportEnd || null,
      eolDate: form.eolDate || null,
      versions: this.versionsText()
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    };

    const technology = this.technologies().find((t) => t.name === form.technology);
    if (!form.id && !technology) {
      this.error.set('That technology is no longer in the registry.');
      return;
    }

    this.saving.set(true);
    const request = form.id
      ? this.api.updateCycle(form.id, body)
      : this.api.createCycle(technology!.id, body);
    request.subscribe(this.done(() => this.cycleDraft.set(null), 'That cycle could not be saved.'));
  }

  protected removeTechnology(technology: Technology): void {
    if (!confirm(`Archive ${technology.name}? It disappears from the registry but its history is kept.`)) {
      return;
    }
    this.api
      .archiveTechnology(technology.id)
      .subscribe(this.done(() => undefined, `${technology.name} could not be archived.`));
  }

  protected removeCycle(cycle: Cycle): void {
    if (!confirm(`Delete cycle ${cycle.technology} ${cycle.cycle}?`)) {
      return;
    }
    this.api
      .deleteCycle(cycle.id)
      .subscribe(this.done(() => undefined, `${cycle.technology} ${cycle.cycle} could not be deleted.`));
  }

  private done(after: () => void, fallback: string) {
    return {
      next: () => {
        this.saving.set(false);
        this.error.set(null);
        after();
        this.api.reload();
      },
      error: (err: { error?: { message?: string | string[] } }) => {
        this.saving.set(false);
        const message = err.error?.message;
        this.error.set(Array.isArray(message) ? message.join('. ') : (message ?? fallback));
      },
    };
  }


  protected date = formatDate;
  protected days = formatDays;
}

