import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Api,
  ApiChange,
  ApiComponent,
  ApiEnvironment,
  ApiVerification,
  ApiVersionOption,
} from '../../core/api';
import { SessionStore } from '../../core/session';
import { Celebrations, celebrationFor } from '../../core/celebration.service';
import { formatDate, formatDays, SupportStatus } from '../../core/lifecycle';
import { ChangeTimeline } from '../../shared/change-timeline';
import { Modal } from '../../shared/modal';
import { TechIcon } from '../../shared/tech-icon';
import { MIN_WORKING_MS, Working } from '../../shared/working';

@Component({
  selector: 'lime-update-component',
  imports: [FormsModule, Modal, TechIcon, ChangeTimeline, Working],
  host: { class: 'block' },
  template: `
    <lime-modal
      [title]="component().technology"
      [subtitle]="environment().environment + ' · currently ' + component().version"
      (dismiss)="close.emit()"
    >
      <lime-working [active]="saving()" />

      <div class="grid gap-5">
        <div class="flex items-center gap-3 rounded-xl border border-rule bg-elevated px-4 py-3">
          <lime-tech-icon [technology]="component().technology" [size]="32" />
          <div class="min-w-0 flex-1">
            <p class="tabular m-0 text-[17px] font-semibold">{{ component().version }}</p>
            <p class="m-0 text-[12px] text-ink-soft">
              cycle {{ component().cycle }} · support ends
              {{ date(component().eolDate) }} ({{ days(component().daysToEol) }})
            </p>
          </div>
        </div>

        <form class="grid gap-4" (submit)="save($event)">
          <label class="field">
            New version
            <select class="input" [(ngModel)]="version" name="version">
              <option value="">Choose a newer version…</option>
              @for (group of options(); track group.cycle) {
                <optgroup [label]="cycleLabel(group)">
                  @for (v of group.versions; track v) {
                    <option [value]="v">{{ v }}</option>
                  }
                </optgroup>
              }
            </select>
            @if (options().length === 0) {
              <span class="mt-1 block text-[11.5px] text-ink-soft">
                Nothing newer is published. Type a version below if you know one.
              </span>
            }
          </label>

          <label class="field">
            …or type the version
            <input
              class="input tabular"
              [(ngModel)]="version"
              name="typed"
              placeholder="8.0.32"
            />
          </label>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="field">
              Effective date
              <input type="date" class="input" [(ngModel)]="effectiveAt" name="effective" />
            </label>
            <label class="field">
              Reason
              <select class="input" [(ngModel)]="reason" name="reason">
                @for (r of reasons; track r.key) {
                  <option [value]="r.key">{{ r.label }}</option>
                }
              </select>
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="field">
              Change request
              <input
                class="input tabular"
                [(ngModel)]="ticketRef"
                name="ticket"
                placeholder="LIME-1042"
              />
            </label>
            <label class="field">
              Evidence link
              <input
                class="input"
                [(ngModel)]="evidenceUrl"
                name="evidence"
                placeholder="https://git.example.com/infra/pull/218"
              />
            </label>
          </div>

          <label class="field">
            Note
            <input
              class="input"
              [(ngModel)]="note"
              name="note"
              placeholder="Rolled out in the September window"
            />
          </label>

          <p class="m-0 text-[11.5px] text-ink-faint">
            Recorded as {{ actor() }}. Entries cannot be
            edited or deleted afterwards — a mistake is answered with a correcting
            entry.
          </p>

          @if (error()) {
            <p class="m-0 text-[13px] text-overdue" role="alert">{{ error() }}</p>
          }

          <div class="flex justify-end gap-2">
            <button type="button" class="btn" (click)="close.emit()">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">
              {{ saving() ? 'Recording…' : 'Record change' }}
            </button>
          </div>
        </form>

        <div class="border-t border-rule pt-4">
          <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 class="m-0 text-[13px] font-semibold">Recent changes</h3>
            @if (verification(); as check) {
              <span
                class="text-[11.5px]"
                [style.color]="check.intact ? 'var(--color-good)' : 'var(--color-overdue)'"
              >
                @if (check.intact) {
                  {{ check.entries }} entries verified
                } @else {
                  altered at entry {{ check.brokenAt.join(', ') }}
                }
              </span>
            }
          </div>

          <lime-change-timeline [changes]="history()" [limit]="3" />

          @if (history().length > 3) {
            <p class="m-0 mt-1 text-[12px] text-ink-soft">
              {{ history().length - 3 }} older entries — close this and open
              <span class="text-ink">History</span> on the environment.
            </p>
          }
        </div>
      </div>
    </lime-modal>
  `,
})
export class UpdateComponent {
  private readonly api = inject(Api);

  readonly environment = input.required<ApiEnvironment>();
  readonly component = input.required<ApiComponent>();
  readonly close = output<void>();
  readonly saved = output<void>();

  private readonly session = inject(SessionStore);
  private readonly celebrations = inject(Celebrations);

  protected readonly reasons = [
    { key: 'PLANNED_UPGRADE', label: 'Planned upgrade' },
    { key: 'SECURITY_PATCH', label: 'Security patch' },
    { key: 'ROLLBACK', label: 'Rollback' },
    { key: 'DRIFT_CORRECTION', label: 'Drift correction' },
    { key: 'DECOMMISSION', label: 'Decommission' },
  ];

  protected readonly actor = computed(
    () => this.session.user()?.displayName ?? 'you',
  );
  protected readonly reason = signal('PLANNED_UPGRADE');
  protected readonly ticketRef = signal('');
  protected readonly evidenceUrl = signal('');
  protected readonly verification = signal<ApiVerification | null>(null);
  protected readonly version = signal('');
  protected readonly effectiveAt = signal(new Date().toISOString().slice(0, 10));
  protected readonly note = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  private readonly allChanges = signal<ApiChange[]>([]);
  private readonly allOptions = signal<ApiVersionOption[]>([]);

  protected readonly options = computed(() => this.allOptions());

  protected readonly history = computed(() =>
    this.allChanges().filter((c) => c.technology === this.component().technology),
  );

  constructor() {
    queueMicrotask(() => this.load());
  }

  private load(): void {
    this.api
      .versionsFor(this.component().technology, this.component().version)
      .subscribe({ next: (options) => this.allOptions.set(options) });
    this.api
      .history(this.environment().id)
      .subscribe({ next: (changes) => this.allChanges.set(changes) });
    this.api
      .verifyHistory(this.environment().id)
      .subscribe({ next: (result) => this.verification.set(result) });
  }

  protected save(event: Event): void {
    event.preventDefault();
    const version = this.version().trim();

    if (!version) {
      this.error.set('Pick a version, or type the one this environment now runs.');
      return;
    }

    this.saving.set(true);
    const startedAt = Date.now();

    this.api
      .changeComponent(this.environment().id, {
        technology: this.component().technology,
        toVersion: version,
        effectiveAt: this.effectiveAt(),
        note: this.note() || undefined,
        reason: this.reason(),
        ticketRef: this.ticketRef() || undefined,
        evidenceUrl: this.evidenceUrl() || undefined,
      })
      .subscribe({
        next: () => {
          this.afterWorking(startedAt, () => {
            this.saving.set(false);
            this.celebrations.show(this.earned(version));
            this.saved.emit();
            this.close.emit();
          });
        },
        error: (err: { error?: { message?: string | string[] } }) => {
          const message = err.error?.message;
          this.afterWorking(startedAt, () => {
            this.saving.set(false);
            this.error.set(
              Array.isArray(message)
                ? message.join('. ')
                : (message ?? 'Could not record that change.'),
            );
          });
        },
      });
  }

  private afterWorking(startedAt: number, then: () => void): void {
    const remaining = MIN_WORKING_MS - (Date.now() - startedAt);
    if (remaining <= 0) {
      then();
      return;
    }
    setTimeout(then, remaining);
  }

  private earned(version: string) {
    const group = this.options().find((option) =>
      option.versions.includes(version),
    );

    const days = group?.eolDate
      ? Math.round(
          (Date.parse(`${group.eolDate}T00:00:00Z`) - Date.now()) / 86_400_000,
        )
      : null;

    return celebrationFor({
      technology: this.component().technology,
      environment: this.environment().environment,
      fromVersion: this.component().version,
      toVersion: version,
      previousStatus: this.component().status as SupportStatus,
      daysOnNewVersion: days,
      otherStatuses: this.environment()
        .components.filter((c) => c.technology !== this.component().technology)
        .map((c) => c.status as SupportStatus),
    });
  }

  protected csvUrl(): string {
    return this.api.historyCsvUrl(this.environment().id);
  }

  protected reasonLabel(reason: string): string {
    return (
      this.reasons.find((r) => r.key === reason)?.label ??
      reason.toLowerCase().replace(/_/g, ' ')
    );
  }

  protected reasonColour(reason: string): string {
    switch (reason) {
      case 'SECURITY_PATCH':
        return 'var(--color-overdue)';
      case 'ROLLBACK':
      case 'DRIFT_CORRECTION':
        return 'var(--color-soon)';
      case 'INITIAL_RECORD':
        return 'var(--color-ink-faint)';
      default:
        return 'var(--color-accent-bright)';
    }
  }

  protected cycleLabel(group: ApiVersionOption): string {
    if (!group.eolDate) {
      return `Cycle ${group.cycle} — no published end of life`;
    }

    const days = Math.round(
      (Date.parse(`${group.eolDate}T00:00:00Z`) - Date.now()) / 86_400_000,
    );

    return days <= 0
      ? `Cycle ${group.cycle} — already ended ${group.eolDate}`
      : `Cycle ${group.cycle} — supported until ${group.eolDate} (${days} days)`;
  }

  protected date = formatDate;
  protected days = formatDays;
}
