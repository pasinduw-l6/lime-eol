import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { Api, ApiCustomer, CommercialModel } from '../../core/api';
import { Feedback } from '../../core/feedback';
import { parseDate, today } from '../../core/lifecycle';
import { COMMERCIAL_MODELS } from '../../core/process';
import { RegistryStore } from '../../core/registry.store';
import { SessionStore } from '../../core/session';
import { Modal } from '../../shared/modal';

interface Draft {
  id?: string;
  name: string;
  code: string;
  contact: string;
  notes: string;
  commercialModel: CommercialModel | '';
  contractStart: string;
  contractEnd: string;
}

@Component({
  selector: 'lime-customers',
  imports: [
    FormsModule,
    HlmBadgeImports,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmLabel,
    HlmTableImports,
    Modal,
  ],
  host: { class: 'block' },
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-3xl font-semibold tracking-tight">Customers</h1>
        <p class="m-0 mt-1 text-sm text-muted-foreground">
          {{ api.customers().length }} customers · commercial model decides whether upgrades are included or quoted
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" [checked]="showArchived()" (change)="toggleArchived()" />
          Show archived
        </label>
        @if (canWrite()) {
          <button type="button" hlmBtn (click)="add()">New customer</button>
        }
      </div>
    </header>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <input
        hlmInput
        type="search"
        class="max-w-sm"
        placeholder="Search name, code or contact"
        aria-label="Search customers"
        [ngModel]="query()"
        (ngModelChange)="query.set($event)"
      />
      <span class="ml-auto text-sm text-muted-foreground">{{ rows().length }} shown</span>
    </div>

    <section hlmCard class="gap-0 py-0">
      <div class="overflow-x-auto">
        <table hlmTable class="w-full">
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh class="pl-6">Customer</th>
              <th hlmTh>Model</th>
              <th hlmTh>Contract</th>
              <th hlmTh>Contact</th>
              <th hlmTh>Projects</th>
              <th hlmTh class="pr-6"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @for (c of rows(); track c.id) {
              <tr hlmTr>
                <td hlmTd class="pl-6">
                  <span class="block font-medium">{{ c.name }}</span>
                  <span class="tabular block text-xs text-muted-foreground">{{ c.code || 'no code' }}</span>
                </td>
                <td hlmTd>
                  @if (c.commercialModel) {
                    <span hlmBadge variant="outline">{{ modelLabel(c.commercialModel) }}</span>
                  } @else {
                    <span class="text-muted-foreground">Not set</span>
                  }
                </td>
                <td hlmTd class="tabular whitespace-normal">
                  @if (c.contractStart || c.contractEnd) {
                    <span class="block">{{ date(c.contractStart) }} – {{ date(c.contractEnd) }}</span>
                    <span class="block text-xs" [class.text-destructive]="contractEnded(c)" [class.text-muted-foreground]="!contractEnded(c)">
                      {{ contractNote(c) }}
                    </span>
                  } @else {
                    <span class="text-muted-foreground">—</span>
                  }
                </td>
                <td hlmTd class="whitespace-normal">{{ c.contact || '—' }}</td>
                <td hlmTd class="whitespace-normal">
                  <span class="flex flex-wrap gap-1">
                    @for (p of projectsOf(c.id); track p.id) {
                      <button type="button" class="rounded-md border px-1.5 text-xs hover:bg-muted" (click)="openProject(p.id)">
                        {{ p.name }}
                      </button>
                    } @empty {
                      <span class="text-muted-foreground">None</span>
                    }
                  </span>
                </td>
                <td hlmTd class="pr-6 text-right">
                  @if (canWrite()) {
                    <span class="flex justify-end gap-1">
                      <button type="button" hlmBtn variant="ghost" size="sm" (click)="edit(c)">Edit</button>
                      <button type="button" hlmBtn variant="ghost" size="sm" class="text-destructive" (click)="archive(c)">Archive</button>
                    </span>
                  }
                </td>
              </tr>
            } @empty {
              <tr hlmTr>
                <td hlmTd colspan="6" class="py-10 text-center text-muted-foreground">No customers match.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    @if (showArchived()) {
      <section hlmCard class="mt-5" aria-labelledby="archived-customers">
        <div hlmCardHeader>
          <h2 hlmCardTitle id="archived-customers">Archived customers</h2>
        </div>
        <div hlmCardContent>
          <ul class="m-0 grid list-none gap-2 p-0">
            @for (c of archived(); track c.id) {
              <li class="flex items-center justify-between gap-3 rounded-md border px-4 py-2 text-sm">
                {{ c.name }}
                @if (canWrite()) {
                  <button type="button" hlmBtn variant="outline" size="sm" (click)="restore(c)">Restore</button>
                }
              </li>
            } @empty {
              <li class="text-sm text-muted-foreground">Nothing archived.</li>
            }
          </ul>
        </div>
      </section>
    }

    @if (draft(); as d) {
      <lime-modal [title]="d.id ? 'Edit customer' : 'New customer'" (dismiss)="draft.set(null)">
        <form class="grid gap-4" (submit)="save($event)">
          <div class="grid gap-3 sm:grid-cols-[1fr_160px]">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Name
              <input hlmInput name="name" [(ngModel)]="d.name" placeholder="Demo Bank" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Code
              <input hlmInput class="tabular uppercase" name="code" [(ngModel)]="d.code" placeholder="DBANK" />
            </label>
          </div>
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Contact
            <input hlmInput name="contact" [(ngModel)]="d.contact" placeholder="Name, email or phone of the customer contact" />
          </label>
          <div class="grid gap-3 sm:grid-cols-3">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Commercial model
              <select hlmInput name="model" [(ngModel)]="d.commercialModel">
                <option value="">Not set</option>
                @for (m of models; track m.key) {
                  <option [value]="m.key">{{ m.label }}</option>
                }
              </select>
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Contract start
              <input hlmInput type="date" name="start" [(ngModel)]="d.contractStart" (ngModelChange)="suggestEnd(d)" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Contract end
              <input hlmInput type="date" name="end" [(ngModel)]="d.contractEnd" />
            </label>
          </div>
          <p class="m-0 -mt-2 text-xs text-muted-foreground">
            Subscription customers get infrastructure upgrade support for the agreed five-year period. The end date
            is filled in five years after the start; change it if the agreement differs.
          </p>
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Notes
            <textarea hlmInput rows="3" class="h-auto py-2" name="notes" [(ngModel)]="d.notes"></textarea>
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="draft.set(null)">Cancel</button>
            <button type="submit" hlmBtn [disabled]="busy()">{{ d.id ? 'Save changes' : 'Create customer' }}</button>
          </div>
        </form>
      </lime-modal>
    }
  `,
})
export class Customers {
  protected readonly api = inject(Api);
  private readonly store = inject(RegistryStore);
  private readonly router = inject(Router);
  private readonly feedback = inject(Feedback);
  private readonly session = inject(SessionStore);

  protected readonly models = COMMERCIAL_MODELS;
  protected readonly canWrite = computed(() => this.session.can('customer:write'));
  protected readonly query = signal('');
  protected readonly busy = signal(false);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly showArchived = signal(false);
  protected readonly archived = signal<ApiCustomer[]>([]);

  protected readonly rows = computed(() => {
    const needle = this.query().trim().toLowerCase();
    return this.api
      .customers()
      .filter(
        (c) =>
          !needle ||
          c.name.toLowerCase().includes(needle) ||
          (c.code ?? '').toLowerCase().includes(needle) ||
          (c.contact ?? '').toLowerCase().includes(needle),
      );
  });

  protected projectsOf(customerId: string) {
    return this.api.projects().filter((p) => p.customerId === customerId);
  }

  protected openProject(projectId: string): void {
    this.store.scope.set(projectId);
    void this.router.navigateByUrl('/overview');
  }

  protected modelLabel(model: CommercialModel): string {
    return COMMERCIAL_MODELS.find((m) => m.key === model)?.label ?? model;
  }

  protected contractEnded(c: ApiCustomer): boolean {
    const end = parseDate(c.contractEnd);
    return !!end && end.getTime() < today().getTime();
  }

  protected contractNote(c: ApiCustomer): string {
    const end = parseDate(c.contractEnd);
    if (!end) return 'No end date';
    const days = Math.round((end.getTime() - today().getTime()) / 86_400_000);
    if (days < 0) return 'Ended';
    const years = days / 365.25;
    return years >= 1 ? `${years.toFixed(1)} years left` : `${days} days left`;
  }

  protected date(value: string | null): string {
    const d = parseDate(value);
    return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '…';
  }

  protected add(): void {
    this.draft.set({
      name: '',
      code: '',
      contact: '',
      notes: '',
      commercialModel: '',
      contractStart: '',
      contractEnd: '',
    });
  }

  protected edit(c: ApiCustomer): void {
    this.draft.set({
      id: c.id,
      name: c.name,
      code: c.code ?? '',
      contact: c.contact ?? '',
      notes: c.notes ?? '',
      commercialModel: c.commercialModel ?? '',
      contractStart: c.contractStart ?? '',
      contractEnd: c.contractEnd ?? '',
    });
  }

  protected suggestEnd(d: Draft): void {
    const start = parseDate(d.contractStart);
    if (start && !d.contractEnd) {
      const end = new Date(Date.UTC(start.getUTCFullYear() + 5, start.getUTCMonth(), start.getUTCDate()));
      d.contractEnd = end.toISOString().slice(0, 10);
    }
  }

  protected save(event: Event): void {
    event.preventDefault();
    const d = this.draft();
    if (!d?.name.trim()) {
      this.feedback.error('A customer needs a name.');
      return;
    }

    const body = {
      name: d.name.trim(),
      code: d.code.trim() || null,
      contact: d.contact.trim() || null,
      notes: d.notes.trim() || null,
      commercialModel: d.commercialModel || null,
      contractStart: d.contractStart || null,
      contractEnd: d.contractEnd || null,
    };

    this.busy.set(true);
    (d.id ? this.api.editCustomer(d.id, body) : this.api.createCustomer(body)).subscribe({
      next: (customer) => {
        this.busy.set(false);
        this.draft.set(null);
        this.feedback.success(`${customer.name} saved.`);
        this.api.reload();
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'Could not save that customer.');
      },
    });
  }

  protected async archive(c: ApiCustomer): Promise<void> {
    const ok = await this.feedback.confirm({
      title: `Archive ${c.name}?`,
      message: 'Only possible when the customer has no active projects. It can be restored later.',
      confirmLabel: 'Archive',
      destructive: true,
    });
    if (!ok) return;

    this.api.archiveCustomer(c.id).subscribe({
      next: () => {
        this.feedback.success(`${c.name} archived.`, { label: 'Undo', run: () => this.restore(c) });
        this.api.reload();
        this.loadArchived();
      },
      error: (err) => this.feedback.failed(err, `${c.name} could not be archived.`),
    });
  }

  protected restore(c: ApiCustomer): void {
    this.api.restoreCustomer(c.id).subscribe({
      next: () => {
        this.feedback.success(`${c.name} restored.`);
        this.api.reload();
        this.loadArchived();
      },
      error: (err) => this.feedback.failed(err, `${c.name} could not be restored.`),
    });
  }

  protected toggleArchived(): void {
    this.showArchived.update((v) => !v);
    this.loadArchived();
  }

  private loadArchived(): void {
    if (!this.showArchived()) return;
    this.api.archivedCustomers().subscribe({
      next: (rows) => this.archived.set(rows),
      error: (err) => this.feedback.failed(err, 'Could not load archived customers.'),
    });
  }
}
