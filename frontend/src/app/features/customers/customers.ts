import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';
import {
  AGREEMENT_TYPES,
  SCOPES,
  TERMS_INFO,
  termsFor,
  STATUS_INFO,
  TYPE_COLOURS,
  termNote,
  typeLabel,
} from '../../core/agreements';
import { AgreementStatus, AgreementType, Api, ApiCustomer } from '../../core/api';
import { Feedback } from '../../core/feedback';
import { parseDate } from '../../core/lifecycle';
import { SessionStore } from '../../core/session';
import { Modal } from '../../shared/modal';

interface Draft {
  name: string;
  code: string;
  notes: string;
}

type StatusFilter = 'ALL' | AgreementStatus;
type TypeFilter = 'ALL' | AgreementType;

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
    RouterLink,
  ],
  host: { class: 'block' },
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-3xl font-semibold tracking-tight">Customers</h1>
        <p class="m-0 mt-1 text-sm text-muted-foreground">
          {{ api.customers().length }} customers · the agreement decides whether an upgrade is included or quoted
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

    <section class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      @for (card of cards(); track card.key) {
        <button
          type="button"
          hlmCard
          class="gap-1 px-5 py-4 text-left transition-colors hover:bg-muted/50"
          [style.box-shadow]="statusFilter() === card.key ? '0 0 0 2px ' + card.colour : null"
          (click)="statusFilter.set(statusFilter() === card.key ? 'ALL' : card.key)"
        >
          <span class="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span class="size-2 rounded-full" [style.background]="card.colour"></span>
            {{ card.label }}
          </span>
          <span class="text-3xl font-semibold tabular">{{ card.count }}</span>
          <span class="text-[12px] text-muted-foreground">{{ card.hint }}</span>
        </button>
      }
    </section>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <input
        hlmInput
        type="search"
        class="h-9 max-w-xs"
        placeholder="Search name, code or contact"
        aria-label="Search customers"
        [ngModel]="query()"
        (ngModelChange)="query.set($event)"
      />
      <div class="segmented" role="group" aria-label="Agreement type">
        @for (t of typeFilters; track t.key) {
          <button
            type="button"
            class="px-3 py-1 text-[13px]"
            [class.bg-background]="typeFilter() === t.key"
            [class.shadow-sm]="typeFilter() === t.key"
            [class.text-foreground]="typeFilter() === t.key"
            [class.text-ink-soft]="typeFilter() !== t.key"
            (click)="typeFilter.set(t.key)"
          >{{ t.label }}</button>
        }
      </div>
      @if (statusFilter() !== 'ALL') {
        <button type="button" hlmBtn variant="ghost" size="sm" (click)="statusFilter.set('ALL')">
          {{ statusLabel(statusFilter()) }} only ✕
        </button>
      }
      <span class="ml-auto text-sm text-muted-foreground">{{ rows().length }} shown</span>
    </div>

    <section hlmCard class="gap-0 py-0">
      <div class="overflow-x-auto">
        <table hlmTable class="w-full">
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh class="pl-6">Customer</th>
              <th hlmTh>Status</th>
              <th hlmTh>Agreement</th>
              <th hlmTh>Coverage</th>
              <th hlmTh>
                <button type="button" class="flex items-center gap-1" (click)="sortByRenewal.set(!sortByRenewal())">
                  Term {{ sortByRenewal() ? '↑' : '' }}
                </button>
              </th>
              <th hlmTh>Primary contact</th>
              <th hlmTh>Projects</th>
              <th hlmTh class="pr-6"><span class="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @for (c of rows(); track c.id) {
              @let status = c.agreementStatus ?? 'NONE';
              <tr hlmTr class="cursor-pointer" (click)="open(c)">
                <td hlmTd class="pl-6">
                  <a [routerLink]="['/customers', c.id]" class="block font-medium hover:underline" (click)="$event.stopPropagation()">{{ c.name }}</a>
                  <span class="tabular block text-xs text-muted-foreground">{{ c.code || 'no code' }}</span>
                </td>
                <td hlmTd>
                  <span class="inline-flex items-center gap-1.5 text-[13px]" [style.color]="statusColour(status)">
                    <span class="size-2 rounded-full" [style.background]="statusColour(status)"></span>
                    {{ statusLabel(status) }}
                  </span>
                </td>
                <td hlmTd>
                  @if (c.agreement; as a) {
                    <span
                      hlmBadge
                      class="border"
                      [style.color]="typeColour(a.type)"
                      [style.border-color]="tint(typeColour(a.type), 40)"
                      [style.background]="tint(typeColour(a.type), 10)"
                    >{{ typeLabel(a.type) }}</span>
                  } @else {
                    <span class="text-muted-foreground">—</span>
                  }
                </td>
                <td hlmTd>
                  @if (c.agreement; as a) {
                    <span class="grid gap-0.5 text-[12px]">
                      @for (s of scopes; track s.key) {
                        @let t = terms(s.key, a.coverage);
                        <span class="flex items-center gap-1.5" [title]="s.label + ': ' + termsInfo[t].long">
                          <span class="size-1.5 rounded-full" [style.background]="termsInfo[t].colour"></span>
                          <span class="text-muted-foreground">{{ s.key === 'INFRASTRUCTURE' ? 'Infra' : 'App' }}</span>
                          <span [style.color]="termsInfo[t].colour">{{ termsInfo[t].label }}</span>
                        </span>
                      }
                    </span>
                  } @else {
                    <span class="text-muted-foreground">—</span>
                  }
                </td>
                <td hlmTd class="tabular whitespace-normal">
                  @if (c.agreement && !c.agreement.startDate && !c.agreement.endDate) {
                    <span class="text-muted-foreground">No dates set</span>
                  } @else if (c.agreement; as a) {
                    <span class="block text-[13px]">{{ date(a.startDate) }} – {{ date(a.endDate) }}</span>
                    <span class="block text-xs" [style.color]="status === 'EXPIRED' ? 'var(--color-overdue)' : status === 'EXPIRING' ? 'var(--color-soon)' : null" [class.text-muted-foreground]="status === 'ACTIVE' || status === 'UPCOMING'">
                      {{ termNote(a.endDate) }}{{ a.autoRenew ? ' · auto-renews' : '' }}
                    </span>
                  } @else {
                    <span class="text-muted-foreground">—</span>
                  }
                </td>
                <td hlmTd class="whitespace-normal">
                  @if (c.primaryContact; as p) {
                    <span class="block text-[13px]">{{ p.name }}</span>
                    <span class="block text-xs text-muted-foreground">{{ p.role || p.email || p.phone || '' }}</span>
                  } @else {
                    <span class="text-muted-foreground">—</span>
                  }
                </td>
                <td hlmTd class="whitespace-normal">
                  <span class="flex flex-wrap gap-1">
                    @for (p of projectsOf(c.id); track p.id) {
                      <span class="inline-flex items-center gap-1 rounded-md border px-1.5 text-xs">
                        {{ p.name }}
                        @if (p.risk.eol > 0) {
                          <span class="rounded bg-destructive/10 px-1 text-[10px] text-destructive tabular" title="Components past end of life">{{ p.risk.eol }}</span>
                        }
                      </span>
                    } @empty {
                      <span class="text-muted-foreground">None</span>
                    }
                  </span>
                </td>
                <td hlmTd class="pr-6 text-right text-muted-foreground">›</td>
              </tr>
            } @empty {
              <tr hlmTr>
                <td hlmTd colspan="8" class="py-10 text-center text-muted-foreground">No customers match.</td>
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
      <lime-modal title="New customer" subtitle="Add the agreement and contacts on the next page." (dismiss)="draft.set(null)">
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
            Notes
            <textarea hlmInput rows="3" class="h-auto py-2" name="notes" [(ngModel)]="d.notes"></textarea>
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="draft.set(null)">Cancel</button>
            <button type="submit" hlmBtn [disabled]="busy()">Create and continue</button>
          </div>
        </form>
      </lime-modal>
    }
  `,
})
export class Customers {
  protected readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly feedback = inject(Feedback);
  private readonly session = inject(SessionStore);

  protected readonly scopes = SCOPES;
  protected readonly termsInfo = TERMS_INFO;
  protected readonly terms = termsFor;
  protected readonly typeLabel = typeLabel;
  protected readonly termNote = termNote;
  protected readonly canWrite = computed(() => this.session.can('customer:write'));
  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly typeFilter = signal<TypeFilter>('ALL');
  protected readonly sortByRenewal = signal(false);
  protected readonly busy = signal(false);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly showArchived = signal(false);
  protected readonly archived = signal<ApiCustomer[]>([]);

  protected readonly typeFilters: { key: TypeFilter; label: string }[] = [
    { key: 'ALL', label: 'All types' },
    ...AGREEMENT_TYPES.map((t) => ({ key: t.key as TypeFilter, label: t.label })),
  ];

  protected readonly cards = computed(() => {
    const all = this.api.customers();
    const count = (status: AgreementStatus) => all.filter((c) => (c.agreementStatus ?? 'NONE') === status).length;
    return [
      { key: 'ACTIVE' as const, label: 'Active', count: count('ACTIVE'), colour: STATUS_INFO.ACTIVE.colour, hint: 'Agreement running' },
      { key: 'EXPIRING' as const, label: 'Expiring in 90 days', count: count('EXPIRING'), colour: STATUS_INFO.EXPIRING.colour, hint: 'Start the renewal' },
      { key: 'EXPIRED' as const, label: 'Expired', count: count('EXPIRED'), colour: STATUS_INFO.EXPIRED.colour, hint: 'Upgrades are quoted until renewed' },
      { key: 'NONE' as const, label: 'No agreement', count: count('NONE'), colour: STATUS_INFO.NONE.colour, hint: 'Add one to know what is covered' },
    ];
  });

  protected readonly rows = computed(() => {
    const needle = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    const type = this.typeFilter();

    const list = this.api.customers().filter((c) => {
      const contact = c.primaryContact;
      const text = [c.name, c.code, c.contact, contact?.name, contact?.email].filter(Boolean).join(' ').toLowerCase();
      if (needle && !text.includes(needle)) return false;
      if (status !== 'ALL' && (c.agreementStatus ?? 'NONE') !== status) return false;
      if (type !== 'ALL' && c.agreement?.type !== type) return false;
      return true;
    });

    if (!this.sortByRenewal()) return list;
    return [...list].sort((a, b) => (a.agreement?.endDate ?? '9999').localeCompare(b.agreement?.endDate ?? '9999'));
  });

  protected projectsOf(customerId: string) {
    return this.api.projects().filter((p) => p.customerId === customerId);
  }

  protected open(c: ApiCustomer): void {
    void this.router.navigate(['/customers', c.id]);
  }

  protected statusLabel(status: AgreementStatus | 'ALL'): string {
    return status === 'ALL' ? 'All' : STATUS_INFO[status].label;
  }

  protected statusColour(status: AgreementStatus): string {
    return STATUS_INFO[status].colour;
  }

  protected typeColour(type: AgreementType): string {
    return TYPE_COLOURS[type];
  }

  protected tint(colour: string, percent: number): string {
    return `color-mix(in oklab, ${colour} ${percent}%, transparent)`;
  }

  protected date(value: string | null): string {
    const d = parseDate(value);
    return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '…';
  }

  protected add(): void {
    this.draft.set({ name: '', code: '', notes: '' });
  }

  protected save(event: Event): void {
    event.preventDefault();
    const d = this.draft();
    if (!d?.name.trim()) {
      this.feedback.error('A customer needs a name.');
      return;
    }

    this.busy.set(true);
    this.api
      .createCustomer({ name: d.name.trim(), code: d.code.trim() || null, notes: d.notes.trim() || null })
      .subscribe({
        next: (customer) => {
          this.busy.set(false);
          this.draft.set(null);
          this.api.reload();
          void this.router.navigate(['/customers', customer.id]);
        },
        error: (err) => {
          this.busy.set(false);
          this.feedback.failed(err, 'Could not create that customer.');
        },
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
