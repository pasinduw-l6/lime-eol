import { JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { Api, ApiAuditRow, ApiUser } from '../../core/api';
import { Feedback } from '../../core/feedback';

const PAGE = 50;

@Component({
  selector: 'lime-audit-log',
  imports: [FormsModule, JsonPipe, HlmButton, HlmCardImports, HlmInput, HlmLabel, HlmTableImports],
  host: { class: 'block' },
  template: `
    <form class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_160px_auto_auto] lg:items-end" (submit)="search($event)">
      <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
        Record type
        <select hlmInput name="entity" [(ngModel)]="entity">
          <option value="">All</option>
          @for (e of entities(); track e) {
            <option [value]="e">{{ e }}</option>
          }
        </select>
      </label>
      <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
        Person
        <select hlmInput name="user" [(ngModel)]="userId">
          <option value="">Anyone</option>
          @for (u of users(); track u.id) {
            <option [value]="u.id">{{ u.name }}</option>
          }
        </select>
      </label>
      <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
        From
        <input hlmInput type="date" name="from" [(ngModel)]="from" />
      </label>
      <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
        To
        <input hlmInput type="date" name="to" [(ngModel)]="to" />
      </label>
      <button type="submit" hlmBtn>Filter</button>
      <button type="button" hlmBtn variant="outline" [disabled]="rows().length === 0" (click)="exportCsv()">Export CSV</button>
    </form>

    <section hlmCard class="gap-0 py-0">
      <div class="overflow-x-auto">
        <table hlmTable class="w-full">
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh class="pl-6">When</th>
              <th hlmTh>Who</th>
              <th hlmTh>Action</th>
              <th hlmTh>Record</th>
              <th hlmTh class="pr-6">Details</th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @for (r of rows(); track r.id) {
              <tr hlmTr>
                <td hlmTd class="tabular pl-6">{{ when(r.at) }}</td>
                <td hlmTd>{{ r.user?.name ?? 'System' }}</td>
                <td hlmTd>
                  <span class="font-medium">{{ r.entity }}</span>
                  <span class="text-muted-foreground"> · {{ r.action }}</span>
                </td>
                <td hlmTd class="tabular text-xs text-muted-foreground">{{ r.entityId ?? '—' }}</td>
                <td hlmTd class="pr-6">
                  @if (r.data) {
                    <button type="button" class="text-sm text-primary hover:underline" (click)="toggle(r.id)">
                      {{ open() === r.id ? 'Hide' : 'Show' }}
                    </button>
                  }
                </td>
              </tr>
              @if (open() === r.id) {
                <tr hlmTr>
                  <td hlmTd colspan="5" class="bg-muted/40 px-6 whitespace-normal">
                    <pre class="tabular m-0 max-h-72 overflow-auto text-xs">{{ r.data | json }}</pre>
                  </td>
                </tr>
              }
            } @empty {
              <tr hlmTr>
                <td hlmTd colspan="5" class="py-10 text-center text-muted-foreground">Nothing recorded for these filters.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <footer class="flex items-center justify-between gap-3 border-t px-6 py-3 text-sm text-muted-foreground">
        <span>{{ total() }} entries</span>
        <span class="flex items-center gap-2">
          <button type="button" hlmBtn variant="outline" size="sm" [disabled]="offset() === 0" (click)="page(-1)">Previous</button>
          <span class="tabular">{{ offset() + 1 }}–{{ offset() + rows().length }}</span>
          <button type="button" hlmBtn variant="outline" size="sm" [disabled]="offset() + rows().length >= total()" (click)="page(1)">Next</button>
        </span>
      </footer>
    </section>
  `,
})
export class AuditLog {
  private readonly api = inject(Api);
  private readonly feedback = inject(Feedback);

  protected entity = '';
  protected userId = '';
  protected from = '';
  protected to = '';

  protected readonly rows = signal<ApiAuditRow[]>([]);
  protected readonly total = signal(0);
  protected readonly entities = signal<string[]>([]);
  protected readonly users = signal<ApiUser[]>([]);
  protected readonly offset = signal(0);
  protected readonly open = signal<string | null>(null);

  constructor() {
    this.api.allUsers().subscribe({ next: (users) => this.users.set(users) });
    this.load();
  }

  protected search(event: Event): void {
    event.preventDefault();
    this.offset.set(0);
    this.load();
  }

  protected page(direction: number): void {
    this.offset.update((o) => Math.max(0, o + direction * PAGE));
    this.load();
  }

  protected toggle(id: string): void {
    this.open.update((current) => (current === id ? null : id));
  }

  private load(): void {
    this.api
      .audit({
        entity: this.entity,
        userId: this.userId,
        from: this.from,
        to: this.to,
        limit: PAGE,
        offset: this.offset(),
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.rows);
          this.total.set(page.total);
          this.entities.set(page.entities);
        },
        error: (err) => this.feedback.failed(err, 'Could not load the audit log.'),
      });
  }

  protected when(value: string): string {
    return new Date(value).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected exportCsv(): void {
    const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['When', 'Who', 'Record type', 'Action', 'Record id', 'Details'].map(quote).join(','),
      ...this.rows().map((r) =>
        [r.at, r.user?.name ?? 'System', r.entity, r.action, r.entityId ?? '', JSON.stringify(r.data ?? '')]
          .map(quote)
          .join(','),
      ),
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
