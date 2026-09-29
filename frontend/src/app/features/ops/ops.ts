import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionStore } from '../../core/session';

type Severity = 'critical' | 'warning' | 'info' | 'good';
type Pass = 'eol' | 'events' | 'digest';

interface HistoryRow {
  kind: string;
  dedupKey: string;
  success: boolean;
  error: string | null;
  sentAt: string;
  sentBy: string | null;
}

interface History {
  events: HistoryRow[];
}

const ICONS: Record<Severity, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
  good: '🟢',
};

/**
 * Operations. Restricted to ADMIN, and left out of the navigation.
 *
 * Being unlisted is tidiness rather than a control - this route name sits in
 * the JavaScript bundle like every other. The API enforces the role.
 */
@Component({
  selector: 'lime-ops',
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <header class="mb-6">
      <h1 class="m-0 text-[26px] font-semibold tracking-[-0.02em]">Operations</h1>
      <p class="mt-1 mb-0 text-[14px] text-ink-soft">
        Send to the team, and re-run anything the schedule has already done.
      </p>
    </header>

    <section class="card mb-5 p-5">
      <h2 class="m-0 mb-1 text-[15px] font-semibold">Run a pass now</h2>
      <p class="mt-0 mb-4 text-[13px] text-ink-soft">
        Force repeats what has already been announced — for when the team missed
        it, or an old warning has become relevant again.
      </p>

      <div class="flex flex-wrap items-center gap-2">
        @for (pass of passes; track pass.id) {
          <button class="btn" (click)="run(pass.id, false)" [disabled]="busy()">
            {{ pass.label }}
          </button>
          <button class="btn" (click)="run(pass.id, true)" [disabled]="busy()">
            {{ pass.label }} — force
          </button>
        }
        <button class="btn" (click)="test()" [disabled]="busy()">
          Test the webhook
        </button>
      </div>

      @if (runResult()) {
        <pre class="mt-4 overflow-x-auto rounded bg-black/20 p-3 text-[12px]">{{ runResult() }}</pre>
      }
    </section>

    <section class="card mb-5 p-5">
      <h2 class="m-0 mb-4 text-[15px] font-semibold">Send a message</h2>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="grid gap-3">
          <label class="field">
            Title
            <input class="input" [(ngModel)]="title" name="title"
              placeholder="Maintenance window Saturday 02:00–04:00" />
          </label>

          <label class="field">
            Subtitle
            <input class="input" [(ngModel)]="subtitle" name="subtitle"
              placeholder="NTB and UB will be unavailable." />
          </label>

          <label class="field">
            Severity
            <select class="input" [(ngModel)]="severity" name="severity">
              @for (s of severities; track s) {
                <option [value]="s">{{ ICONS[s] }} {{ s }}</option>
              }
            </select>
          </label>

          <label class="field">
            Body — one line each
            <textarea class="input min-h-[7rem]" [(ngModel)]="body" name="body"
              placeholder="Both clusters will be restarted.&#10;No data loss is expected."></textarea>
          </label>

          <label class="flex items-center gap-2 text-[13px] text-ink-soft">
            <input type="checkbox" [(ngModel)]="tagEveryone" name="tag" />
            Tag the whole team
          </label>

          <div class="flex gap-2">
            <button class="btn" (click)="preview()" [disabled]="!title() || busy()">
              Preview
            </button>
            <button class="btn btn-primary" (click)="confirmSend()"
              [disabled]="!title() || busy()">
              {{ confirming() ? 'Confirm — post to the channel' : 'Send' }}
            </button>
            @if (confirming()) {
              <button class="btn" (click)="confirming.set(false)">Cancel</button>
            }
          </div>

          @if (sendResult()) {
            <p class="m-0 text-[13px]" [class.text-overdue]="sendFailed()">
              {{ sendResult() }}
            </p>
          }
        </div>

        <div>
          <p class="mt-0 mb-2 text-[12px] tracking-[0.1em] text-ink-soft uppercase">
            Roughly how it will look
          </p>

          <div class="rounded-lg border p-4" [style.border-left]="'4px solid ' + accent()">
            <p class="m-0 text-[15px] font-semibold">
              {{ ICONS[severity()] }} {{ title() || 'Title' }}
            </p>
            @if (subtitle()) {
              <p class="mt-1 mb-0 text-[13px] text-ink-soft">{{ subtitle() }}</p>
            }
            @for (line of bodyLines(); track $index) {
              <p class="mt-2 mb-0 text-[13px]">{{ line }}</p>
            }
            @if (tagEveryone()) {
              <p class="mt-3 mb-0 text-[13px] text-accent-bright">&#64;the team</p>
            }
          </div>

          @if (payload()) {
            <details class="mt-3">
              <summary class="cursor-pointer text-[12px] text-ink-soft">
                Exact payload
              </summary>
              <pre class="mt-2 overflow-x-auto rounded bg-black/20 p-3 text-[11px]">{{ payload() }}</pre>
            </details>
          }
        </div>
      </div>
    </section>

    <section class="card p-5">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="m-0 text-[15px] font-semibold">Recently announced</h2>
        <button class="btn" (click)="loadHistory()">Refresh</button>
      </div>

      @if (history().length === 0) {
        <p class="m-0 text-[13px] text-ink-soft">Nothing yet.</p>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-[13px]">
            <thead class="text-ink-soft">
              <tr>
                <th class="py-1 text-left">When</th>
                <th class="py-1 text-left">Kind</th>
                <th class="py-1 text-left">By</th>
                <th class="py-1 text-left">Result</th>
              </tr>
            </thead>
            <tbody>
              @for (row of history(); track row.dedupKey) {
                <tr class="border-t">
                  <td class="py-1.5">{{ row.sentAt.slice(0, 16).replace('T', ' ') }}</td>
                  <td class="py-1.5">{{ row.kind }}</td>
                  <td class="py-1.5">{{ row.sentBy ?? '—' }}</td>
                  <td class="py-1.5" [class.text-overdue]="!row.success">
                    {{ row.success ? 'sent' : (row.error ?? 'failed') }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class Ops {
  private readonly http = inject(HttpClient);
  protected readonly session = inject(SessionStore);

  protected readonly ICONS = ICONS;
  protected readonly severities: Severity[] = ['critical', 'warning', 'info', 'good'];
  protected readonly passes: { id: Pass; label: string }[] = [
    { id: 'eol', label: 'End-of-life alerts' },
    { id: 'events', label: 'Jira and plans' },
    { id: 'digest', label: 'Weekly digest' },
  ];

  protected readonly title = signal('');
  protected readonly subtitle = signal('');
  protected readonly body = signal('');
  protected readonly severity = signal<Severity>('info');
  protected readonly tagEveryone = signal(true);

  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);
  protected readonly runResult = signal('');
  protected readonly sendResult = signal('');
  protected readonly sendFailed = signal(false);
  protected readonly payload = signal('');
  protected readonly history = signal<HistoryRow[]>([]);

  protected readonly bodyLines = computed(() =>
    this.body().split('\n').filter((line) => line.trim() !== ''),
  );

  protected readonly accent = computed(() => {
    switch (this.severity()) {
      case 'critical':
        return 'var(--color-overdue, #e5484d)';
      case 'warning':
        return '#f5a524';
      case 'good':
        return '#30a46c';
      default:
        return 'var(--color-accent-bright, #4b9fff)';
    }
  });

  constructor() {
    this.loadHistory();
  }

  protected loadHistory(): void {
    this.http.get<History>('/api/v1/ops/notifications/history?limit=30').subscribe({
      next: (result) => this.history.set(result.events),
      error: () => this.history.set([]),
    });
  }

  protected run(pass: Pass, force: boolean): void {
    this.busy.set(true);
    this.runResult.set('');

    this.http
      .post(`/api/v1/ops/notifications/run/${pass}?force=${force}`, {})
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.runResult.set(JSON.stringify(result, null, 2));
          this.loadHistory();
        },
        error: (error: { error?: { message?: string } }) => {
          this.busy.set(false);
          this.runResult.set(error.error?.message ?? 'That failed.');
        },
      });
  }

  protected test(): void {
    this.busy.set(true);
    this.http.post<{ ok: boolean; detail: string }>('/api/v1/ops/notifications/test', {})
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.runResult.set(result.detail);
        },
        error: () => {
          this.busy.set(false);
          this.runResult.set('The test failed.');
        },
      });
  }

  protected preview(): void {
    this.http.post('/api/v1/ops/notifications/preview', this.message()).subscribe({
      next: (card) => this.payload.set(JSON.stringify(card, null, 2)),
      error: () => this.payload.set('Could not render that.'),
    });
  }

  /**
   * Two clicks, deliberately. This posts to a channel six people read, and a
   * misfire cannot be recalled.
   */
  protected confirmSend(): void {
    if (!this.confirming()) {
      this.confirming.set(true);
      this.preview();
      return;
    }

    this.busy.set(true);
    this.confirming.set(false);

    this.http
      .post<{ sent: boolean; error: string | null; dryRun: boolean }>(
        '/api/v1/ops/notifications/send',
        this.message(),
      )
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.sendFailed.set(!result.sent);
          this.sendResult.set(
            result.sent
              ? result.dryRun
                ? 'Rendered only — the server is in dry-run mode, so nothing was posted.'
                : 'Posted to the channel.'
              : (result.error ?? 'That failed.'),
          );
          this.loadHistory();
        },
        error: (error: { error?: { message?: string } }) => {
          this.busy.set(false);
          this.sendFailed.set(true);
          this.sendResult.set(error.error?.message ?? 'That failed.');
        },
      });
  }

  private message() {
    return {
      title: this.title(),
      subtitle: this.subtitle() || undefined,
      severity: this.severity(),
      lines: this.bodyLines(),
      mention: this.tagEveryone() ? ['everyone'] : [],
    };
  }
}
