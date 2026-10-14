import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { Api } from '../../core/api';
import { Feedback } from '../../core/feedback';

interface VersionFileStatus {
  repo: string;
  file: string;
  branch: string;
  url: string;
  token: boolean;
  status: 'NEVER' | 'OK' | 'WARN' | 'ERROR';
  message: string | null;
  warnings: string[];
  managed: number;
  lastCheckedAt: string | null;
  lastAppliedAt: string | null;
  lastCommit: { sha: string; message: string | null; author: string | null; url: string | null; at: string | null } | null;
}

interface SyncResult {
  status: 'OK' | 'WARN' | 'ERROR' | 'UNCHANGED';
  message: string;
  applied: string[];
  warnings: string[];
}

const STATE: Record<VersionFileStatus['status'], { label: string; colour: string }> = {
  NEVER: { label: 'Not synced yet', colour: 'var(--muted-foreground)' },
  OK: { label: 'In sync', colour: 'var(--success)' },
  WARN: { label: 'In sync, with warnings', colour: 'var(--warning)' },
  ERROR: { label: 'Sync failed', colour: 'var(--destructive)' },
};

/** eol-versions.yml in GitHub: where it is read from, the last commit applied, and Sync now. */
@Component({
  selector: 'lime-version-file',
  imports: [HlmCardImports, HlmButton],
  host: { class: 'block' },
  template: `
    <section hlmCard class="mt-5 gap-0 py-0">
      <header class="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div class="min-w-0">
          <h2 class="m-0 flex items-center gap-2 text-base font-semibold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
            </svg>
            Versions file
          </h2>
          @if (state(); as s) {
            <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">
              Edit <a [href]="s.url" target="_blank" rel="noopener" class="text-primary hover:underline">{{ s.repo }} · {{ s.file }}</a>
              on <code>{{ s.branch }}</code> and the tool records the change, with the commit, within 15 minutes.
            </p>
          }
        </div>
        <button type="button" hlmBtn size="sm" variant="outline" [disabled]="busy()" (click)="syncNow()">
          {{ busy() ? 'Syncing…' : 'Sync now' }}
        </button>
      </header>

      @if (state(); as s) {
        <dl class="m-0 grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt class="text-xs text-muted-foreground">Status</dt>
            <dd class="m-0 flex items-center gap-1.5 font-medium" [style.color]="info[s.status].colour">
              <span class="size-2 rounded-full" [style.background]="info[s.status].colour"></span>
              {{ info[s.status].label }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Last commit</dt>
            <dd class="m-0 truncate">
              @if (s.lastCommit; as c) {
                <a [href]="c.url" target="_blank" rel="noopener" class="tabular text-primary hover:underline">{{ c.sha.slice(0, 7) }}</a>
                <span class="text-muted-foreground"> · {{ c.author }} · {{ when(c.at) }}</span>
              } @else {
                <span class="text-muted-foreground">—</span>
              }
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Versions from the file</dt>
            <dd class="m-0">{{ s.managed }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Last checked</dt>
            <dd class="m-0">{{ when(s.lastCheckedAt) }}{{ s.token ? '' : ' · no token' }}</dd>
          </div>
        </dl>

        @if (s.lastCommit?.message; as message) {
          <p class="m-0 border-t px-5 py-2.5 text-[13px] text-muted-foreground">“{{ message }}”</p>
        }
        @if (s.status === 'ERROR' && s.message) {
          <p class="m-0 border-t px-5 py-2.5 text-[13px] text-destructive">{{ s.message }}</p>
        }
        @if (applied().length) {
          <div class="border-t px-5 py-2.5 text-[13px]">
            <p class="m-0 mb-1 font-medium">Recorded just now</p>
            @for (a of applied(); track a) {
              <p class="m-0 text-muted-foreground">{{ a }}</p>
            }
          </div>
        }
        @if (s.warnings.length) {
          <div class="border-t px-5 py-2.5 text-[13px]">
            <p class="m-0 mb-1 font-medium text-warning">Skipped lines in the file</p>
            @for (w of s.warnings; track w) {
              <p class="m-0 text-muted-foreground">{{ w }}</p>
            }
          </div>
        }
      } @else {
        <p class="m-0 px-5 py-4 text-sm text-muted-foreground">Loading…</p>
      }
    </section>
  `,
})
export class VersionFile {
  private readonly http = inject(HttpClient);
  private readonly api = inject(Api);
  private readonly feedback = inject(Feedback);

  protected readonly info = STATE;
  protected readonly state = signal<VersionFileStatus | null>(null);
  protected readonly applied = signal<string[]>([]);
  protected readonly busy = signal(false);

  constructor() {
    this.load();
  }

  private load(): void {
    this.http.get<VersionFileStatus>('/api/v1/version-file').subscribe({
      next: (s) => this.state.set(s),
      error: (err) => this.feedback.failed(err, 'Could not load the versions file status.'),
    });
  }

  protected syncNow(): void {
    this.busy.set(true);
    this.http.post<SyncResult>('/api/v1/version-file/sync', {}).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.applied.set(result.applied);
        this.load();
        if (result.status === 'ERROR') this.feedback.error(result.message);
        else this.feedback.success(result.message);
        if (result.applied.length) this.api.reload();
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'The sync could not run.');
      },
    });
  }

  protected when(value: string | null): string {
    if (!value) return 'Never';
    return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
