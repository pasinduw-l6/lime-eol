import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';

type Severity = 'critical' | 'warning' | 'info' | 'good';

interface Sendable {
  key: string;
  group: string;
  title: string;
  subtitle: string;
  severity: Severity;
}

interface SendResult {
  dryRun: boolean;
  sent: number;
  failed: number;
  titles: string[];
}

interface SyncResult {
  technologies: number;
  cyclesUpdated: number;
  changes: { technology: string; cycle: string; field: string; from: string | null; to: string | null }[];
  unmatched: { technology: string; cycles: string[] }[];
  failures: { technology: string; reason: string }[];
}

const ICONS: Record<Severity, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
  good: '🟢',
};

@Component({
  selector: 'lime-ops',
  host: { class: 'block' },
  template: `
    <header class="mb-6">
      <h1 class="m-0 text-[26px] font-semibold tracking-[-0.02em]">Operations</h1>
      <p class="mt-1 mb-0 text-[14px] text-ink-soft">
        Send any notification, as often as you like. Nothing here is recorded,
        so it never silences the scheduled messages.
      </p>
    </header>

    <section class="card mb-5 flex flex-wrap items-center gap-2 p-4">
      <button class="btn" (click)="resync()" [disabled]="busy()">
        {{ busy() === 'resync' ? 'Syncing…' : 'Resync end-of-life dates' }}
      </button>
      <button class="btn" (click)="load()" [disabled]="!!busy()">Refresh list</button>
      <button class="btn btn-primary" (click)="sendAll()"
        [disabled]="!!busy() || items().length === 0">
        Send all {{ items().length }}
      </button>
      <button class="btn" (click)="test()" [disabled]="!!busy()">Test webhook</button>

      <span class="ml-auto text-[13px] text-ink-soft">{{ note() }}</span>
    </section>

    @if (sync(); as s) {
      <section class="card mb-5 p-4 text-[13px]">
        <p class="m-0">
          {{ s.cyclesUpdated }} cycles refreshed across {{ s.technologies }}
          technologies · {{ s.changes.length }} changed
        </p>
        @for (change of s.changes; track $index) {
          <p class="mt-1 mb-0 text-ink-soft">
            {{ change.technology }} {{ change.cycle }} · {{ change.field }}:
            {{ change.from ?? 'none' }} → {{ change.to ?? 'none' }}
          </p>
        }
        @for (u of s.unmatched; track u.technology) {
          <p class="mt-1 mb-0 text-overdue">
            {{ u.technology }}: endoflife.date has no cycle {{ u.cycles.join(', ') }}
            — usually a mistyped version
          </p>
        }
        @for (f of s.failures; track f.technology) {
          <p class="mt-1 mb-0 text-overdue">{{ f.technology }}: {{ f.reason }}</p>
        }
      </section>
    }

    @if (items().length === 0) {
      <p class="text-[14px] text-ink-soft">
        Nothing to send. Try resyncing — a cycle with no end-of-life date never
        raises anything.
      </p>
    }

    @for (group of groups(); track group) {
      <section class="card mb-4 p-4">
        <h2 class="m-0 mb-3 text-[13px] tracking-[0.1em] text-ink-soft uppercase">
          {{ group }}
        </h2>

        @for (item of inGroup(group); track item.key) {
          <div class="flex items-center gap-3 border-t py-2.5 first:border-t-0">
            <span class="text-[15px]">{{ ICONS[item.severity] }}</span>
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate text-[14px]">{{ item.title }}</p>
              @if (item.subtitle) {
                <p class="m-0 truncate text-[12px] text-ink-soft">{{ item.subtitle }}</p>
              }
            </div>
            <button class="btn shrink-0" (click)="send(item)" [disabled]="!!busy()">
              {{ busy() === item.key ? 'Sending…' : 'Send' }}
            </button>
          </div>
        }
      </section>
    }
  `,
})
export class Ops {
  private readonly http = inject(HttpClient);

  protected readonly ICONS = ICONS;
  protected readonly items = signal<Sendable[]>([]);
  protected readonly busy = signal<string | null>(null);
  protected readonly note = signal('');
  protected readonly sync = signal<SyncResult | null>(null);

  protected readonly groups = computed(() => [
    ...new Set(this.items().map((item) => item.group)),
  ]);

  constructor() {
    this.load();
  }

  protected inGroup(group: string): Sendable[] {
    return this.items().filter((item) => item.group === group);
  }

  protected load(): void {
    this.busy.set('load');
    this.http.get<Sendable[]>('/api/v1/ops/notifications/available').subscribe({
      next: (items) => {
        this.busy.set(null);
        this.items.set(items);
        this.note.set(`${items.length} available`);
      },
      error: () => {
        this.busy.set(null);
        this.note.set('Could not load the list.');
      },
    });
  }

  protected send(item: Sendable): void {
    this.post(item.key, { keys: [item.key] });
  }

  protected sendAll(): void {
    this.post('all', {});
  }

  private post(marker: string, body: { keys?: string[] }): void {
    this.busy.set(marker);
    this.note.set('');

    this.http
      .post<SendResult>('/api/v1/ops/notifications/send-available', body)
      .subscribe({
        next: (result) => {
          this.busy.set(null);
          this.note.set(
            result.dryRun
              ? `Rendered ${result.sent} — dry-run mode, nothing posted.`
              : `Sent ${result.sent}${result.failed > 0 ? `, ${result.failed} failed` : ''}.`,
          );
        },
        error: (error: { error?: { message?: string } }) => {
          this.busy.set(null);
          this.note.set(error.error?.message ?? 'That failed.');
        },
      });
  }

  protected resync(): void {
    this.busy.set('resync');
    this.note.set('');

    this.http.post<SyncResult>('/api/v1/ops/notifications/resync', {}).subscribe({
      next: (result) => {
        this.busy.set(null);
        this.sync.set(result);
        this.load();
      },
      error: (error: { error?: { message?: string } }) => {
        this.busy.set(null);
        this.note.set(error.error?.message ?? 'The sync failed.');
      },
    });
  }

  protected test(): void {
    this.busy.set('test');
    this.http
      .post<{ ok: boolean; detail: string }>('/api/v1/ops/notifications/test', {})
      .subscribe({
        next: (result) => {
          this.busy.set(null);
          this.note.set(result.detail);
        },
        error: () => {
          this.busy.set(null);
          this.note.set('The test failed.');
        },
      });
  }
}
