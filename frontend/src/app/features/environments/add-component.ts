import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiEnvironment, ApiVersionOption } from '../../core/api';
import { SessionStore } from '../../core/session';
import { Celebrations } from '../../core/celebration.service';
import { Modal } from '../../shared/modal';
import { TechIcon } from '../../shared/tech-icon';
import { MIN_WORKING_MS, Working } from '../../shared/working';

/**
 * Add a technology this environment was not known to run.
 *
 * Deliberately the same write as an upgrade — one endpoint, one history chain —
 * so a component that appears later in an environment's life is as traceable as
 * one recorded on day one. The only difference is that there is no "from"
 * version, which the backend records as an INSTALL.
 */
@Component({
  selector: 'lime-add-component',
  imports: [FormsModule, Modal, TechIcon, Working],
  host: { class: 'block' },
  template: `
    <lime-modal
      title="Add a component"
      [subtitle]="environment().environment + ' · ' + available().length + ' technologies not yet recorded here'"
      (dismiss)="close.emit()"
    >
      <lime-working [active]="saving()" label="Recording the component…" />

      <form class="grid gap-4" (submit)="save($event)">
        <label class="field">
          Technology
          <select class="input" [(ngModel)]="technology" name="technology">
            <option value="">Choose a technology…</option>
            @for (t of available(); track t.id) {
              <option [value]="t.name">
                {{ t.name }} — {{ t.componentType.toLowerCase() }}
              </option>
            }
          </select>
          @if (available().length === 0) {
            <span class="mt-1 block text-[11.5px] text-ink-soft">
              Every technology in the registry is already recorded here. Add a new
              one under <span class="text-ink">Lifecycle → Registry</span> first.
            </span>
          }
        </label>

        @if (technology()) {
          <div class="flex items-center gap-3 rounded-xl border border-rule bg-elevated px-4 py-3">
            <lime-tech-icon [technology]="technology()" [size]="32" />
            <div class="min-w-0 flex-1">
              <p class="m-0 text-[15px] font-semibold">{{ technology() }}</p>
              <p class="m-0 text-[12px] text-ink-soft">
                @if (loadingVersions()) {
                  looking up published versions…
                } @else {
                  {{ optionCount() }} versions across {{ options().length }} cycles
                }
              </p>
            </div>
          </div>

          <label class="field">
            Version
            <select class="input" [(ngModel)]="version" name="version">
              <option value="">Choose a version…</option>
              @for (group of options(); track group.cycle) {
                <optgroup [label]="cycleLabel(group)">
                  @for (v of group.versions; track v) {
                    <option [value]="v">{{ v }}</option>
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
              placeholder="Added when the reporting service was introduced"
            />
          </label>

          <p class="m-0 text-[11.5px] text-ink-faint">
            Recorded as {{ actor() }} — the first entry in this component's
            trail on {{ environment().environment }}.
          </p>
        }

        @if (error()) {
          <p class="m-0 text-[13px] text-overdue" role="alert">{{ error() }}</p>
        }

        <div class="flex justify-end gap-2">
          <button type="button" class="btn" (click)="close.emit()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            {{ saving() ? 'Recording…' : 'Add component' }}
          </button>
        </div>
      </form>
    </lime-modal>
  `,
})
export class AddComponent {
  private readonly api = inject(Api);
  private readonly session = inject(SessionStore);
  private readonly celebrations = inject(Celebrations);

  readonly environment = input.required<ApiEnvironment>();
  readonly close = output<void>();
  readonly saved = output<void>();

  /** A first record is rarely an upgrade, so that is not the default here. */
  protected readonly reasons = [
    { key: 'INITIAL_RECORD', label: 'First record of what is running' },
    { key: 'PLANNED_UPGRADE', label: 'Added in a planned change' },
    { key: 'DRIFT_CORRECTION', label: 'Found running but never recorded' },
    { key: 'SECURITY_PATCH', label: 'Security patch' },
  ];

  /** Who the entry will be attributed to: the signed-in account. */
  protected readonly actor = computed(
    () => this.session.user()?.displayName ?? 'you',
  );
  protected readonly technology = signal('');
  protected readonly version = signal('');
  protected readonly reason = signal('INITIAL_RECORD');
  protected readonly effectiveAt = signal(new Date().toISOString().slice(0, 10));
  protected readonly ticketRef = signal('');
  protected readonly evidenceUrl = signal('');
  protected readonly note = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly loadingVersions = signal(false);
  protected readonly options = signal<ApiVersionOption[]>([]);

  /** Only what is not already recorded here — the rest is an upgrade, not an add. */
  protected readonly available = computed(() => {
    const installed = new Set(this.environment().components.map((c) => c.technology));
    return this.api
      .technologies()
      .filter((t) => !installed.has(t.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly optionCount = computed(() =>
    this.options().reduce((total, group) => total + group.versions.length, 0),
  );

  constructor() {
    // Versions are fetched per technology, and no currentVersion is passed:
    // there is nothing installed to be newer than, so the whole published
    // history is fair game — including a deliberately older version.
    effect(() => {
      const name = this.technology();
      this.version.set('');
      this.options.set([]);

      if (!name) {
        return;
      }

      this.loadingVersions.set(true);
      this.api.versionsFor(name).subscribe({
        next: (options) => {
          this.options.set(options);
          this.loadingVersions.set(false);
        },
        error: () => this.loadingVersions.set(false),
      });
    });
  }

  protected save(event: Event): void {
    event.preventDefault();
    const technology = this.technology();
    const version = this.version().trim();

    if (!technology) {
      this.error.set('Choose which technology this environment runs.');
      return;
    }
    if (!version) {
      this.error.set('Pick a version, or type the one this environment runs.');
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const startedAt = Date.now();

    this.api
      .changeComponent(this.environment().id, {
        technology,
        toVersion: version,
        effectiveAt: this.effectiveAt(),
        reason: this.reason(),
        ticketRef: this.ticketRef() || undefined,
        evidenceUrl: this.evidenceUrl() || undefined,
        note: this.note() || undefined,
      })
      .subscribe({
        next: () => {
          this.afterWorking(startedAt, () => {
            this.saving.set(false);
            this.celebrations.show({
              tier: 'ROUTINE',
              title: `${technology} recorded`,
              detail: `${version} · ${this.environment().environment}`,
            });
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
                : (message ?? 'Could not record that component.'),
            );
          });
        },
      });
  }

  /** Runs the callback once the goose has had its full time on screen. */
  private afterWorking(startedAt: number, then: () => void): void {
    const remaining = MIN_WORKING_MS - (Date.now() - startedAt);
    if (remaining <= 0) {
      then();
      return;
    }
    setTimeout(then, remaining);
  }

  /** Says what committing to this cycle actually buys you. */
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
}
