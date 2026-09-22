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
import { ActingUser } from '../../core/acting-user';
import { formatDate, formatDays } from '../../core/lifecycle';
import { Modal } from '../../shared/modal';
import { TechIcon } from '../../shared/tech-icon';

/**
 * Record the version an environment now runs.
 *
 * Two fields do the real work: the version, and the date it actually happened.
 * Engineers record upgrades days after the window, and a history dated by when
 * the paperwork caught up is worthless for reporting.
 */
@Component({
  selector: 'lime-update-component',
  imports: [FormsModule, Modal, TechIcon],
  host: { class: 'block' },
  template: `
    <lime-modal
      [title]="component().technology"
      [subtitle]="environment().environment + ' · currently ' + component().version"
      (dismiss)="close.emit()"
    >
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
            Recorded as {{ actor()?.name ?? 'an unknown user' }}. Entries cannot be
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

        <!-- audit trail -->
        <div class="border-t border-rule pt-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 class="m-0 text-[13px] font-semibold">Change history</h3>
            <span class="flex items-center gap-3 text-[11.5px]">
              @if (verification(); as check) {
                <span [style.color]="check.intact ? 'var(--color-good)' : 'var(--color-overdue)'">
                  @if (check.intact) {
                    {{ check.entries }} entries verified
                  } @else {
                    altered at entry {{ check.brokenAt.join(', ') }}
                  }
                </span>
              }
              <a [href]="csvUrl()" class="text-accent-bright no-underline hover:underline" download>
                Export CSV
              </a>
            </span>
          </div>

          <ol class="m-0 flex list-none flex-col p-0">
            @for (change of history(); track change.id) {
              <li class="flex gap-3 border-b border-rule py-2.5 last:border-b-0">
                <span
                  class="tabular mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-elevated text-[10px] text-ink-soft"
                  [attr.title]="'Entry ' + change.sequence"
                  >{{ change.sequence }}</span
                >
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-baseline gap-x-2">
                    <span class="tabular text-[13px]">
                      @if (change.fromVersion) {
                        {{ change.fromVersion }} → {{ change.toVersion }}
                      } @else {
                        installed {{ change.toVersion }}
                      }
                    </span>
                    <span
                      class="rounded-full border px-2 py-0.5 text-[10.5px]"
                      [style.border-color]="reasonColour(change.reason)"
                      [style.color]="reasonColour(change.reason)"
                      >{{ reasonLabel(change.reason) }}</span
                    >
                    @if (change.ticketRef) {
                      <span class="tabular text-[11px] text-ink-soft">{{ change.ticketRef }}</span>
                    }
                  </span>
                  <span class="block text-[11.5px] text-ink-soft">
                    {{ change.effectiveAt }} · recorded by
                    {{ change.recordedBy ?? 'unknown' }}
                    @if (change.evidenceUrl) {
                      ·
                      <a
                        [href]="change.evidenceUrl"
                        target="_blank"
                        rel="noopener"
                        class="text-accent-bright no-underline hover:underline"
                        >evidence</a
                      >
                    }
                  </span>
                  @if (change.note) {
                    <span class="block text-[11.5px] text-ink-soft">{{ change.note }}</span>
                  }
                </span>
              </li>
            } @empty {
              <li class="py-2 text-[13px] text-ink-soft">
                Nothing recorded yet for {{ component().technology }} here.
              </li>
            }
          </ol>
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

  private readonly acting = inject(ActingUser);

  protected readonly reasons = [
    { key: 'PLANNED_UPGRADE', label: 'Planned upgrade' },
    { key: 'SECURITY_PATCH', label: 'Security patch' },
    { key: 'ROLLBACK', label: 'Rollback' },
    { key: 'DRIFT_CORRECTION', label: 'Drift correction' },
    { key: 'DECOMMISSION', label: 'Decommission' },
  ];

  protected readonly actor = this.acting.current;
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

  /** Only this technology's changes, newest first. */
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
          this.saving.set(false);
          this.saved.emit();
          this.close.emit();
        },
        error: (err: { error?: { message?: string | string[] } }) => {
          this.saving.set(false);
          const message = err.error?.message;
          this.error.set(
            Array.isArray(message) ? message.join('. ') : (message ?? 'Could not record that change.'),
          );
        },
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

  /** Security patches and rollbacks should stand out in a long list. */
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

  /** Says what moving to this cycle actually buys you. */
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
