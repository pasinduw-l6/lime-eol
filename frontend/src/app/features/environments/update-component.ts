import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Api,
  ApiChange,
  ApiComponent,
  ApiEnvironment,
  ApiVersionOption,
} from '../../core/api';
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
              <option value="">Choose a known version…</option>
              @for (group of options(); track group.cycle) {
                <optgroup [label]="'Cycle ' + group.cycle + ' — ends ' + date(group.eolDate)">
                  @for (v of group.versions; track v) {
                    <option [value]="v">{{ v }}</option>
                  }
                  @if (group.latestPatch && !group.versions.includes(group.latestPatch)) {
                    <option [value]="group.latestPatch">
                      {{ group.latestPatch }} (latest in cycle)
                    </option>
                  }
                </optgroup>
              }
            </select>
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
              Note
              <input
                class="input"
                [(ngModel)]="note"
                name="note"
                placeholder="Rolled out in the September window"
              />
            </label>
          </div>

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

        <!-- history for this technology on this environment -->
        <div class="border-t border-rule pt-4">
          <h3 class="m-0 mb-2 text-[13px] font-semibold">History</h3>
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            @for (change of history(); track change.id) {
              <li class="flex gap-3 text-[13px]">
                <span class="tabular shrink-0 text-ink-soft">{{ change.effectiveAt }}</span>
                <span class="min-w-0 flex-1">
                  <span class="tabular block">
                    @if (change.fromVersion) {
                      {{ change.fromVersion }} → {{ change.toVersion }}
                    } @else {
                      installed {{ change.toVersion }}
                    }
                    <span class="text-[11px] text-ink-faint">
                      {{ change.changeType.toLowerCase() }}
                    </span>
                  </span>
                  @if (change.note) {
                    <span class="block text-[11.5px] text-ink-soft">{{ change.note }}</span>
                  }
                </span>
              </li>
            } @empty {
              <li class="text-[13px] text-ink-soft">
                Nothing recorded yet for {{ component().technology }} here.
              </li>
            }
          </ul>
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
      .versionsFor(this.component().technology)
      .subscribe({ next: (options) => this.allOptions.set(options) });
    this.api
      .history(this.environment().id)
      .subscribe({ next: (changes) => this.allChanges.set(changes) });
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

  protected date = formatDate;
  protected days = formatDays;
}
