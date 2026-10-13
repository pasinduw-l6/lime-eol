import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { Api, ApiIntegration, IntegrationKind } from '../../core/api';
import { Feedback } from '../../core/feedback';
import { Modal } from '../../shared/modal';

interface Draft {
  id?: string;
  kind: IntegrationKind;
  name: string;
  baseUrl: string;
  email: string;
  projectKey: string;
  tokenType: 'scoped' | 'classic';
  secret: string;
  enabled: boolean;
  secretHint: string | null;
}

const SECTIONS: { kind: IntegrationKind; title: string; hint: string; add: string }[] = [
  {
    kind: 'JIRA',
    title: 'Jira boards',
    hint: 'Each connection is a Jira site and a default board. Projects pick one; the rest use the server default.',
    add: 'Add Jira board',
  },
  {
    kind: 'TEAMS',
    title: 'Teams channels',
    hint: 'An incoming webhook per channel. End-of-life alerts for a project also go to its channel.',
    add: 'Add Teams channel',
  },
];

@Component({
  selector: 'lime-integrations',
  imports: [FormsModule, HlmBadgeImports, HlmButton, HlmCardImports, HlmInput, HlmLabel, Modal],
  host: { class: 'block' },
  template: `
    @for (section of sections; track section.kind) {
      <section hlmCard class="mb-5 gap-0 p-0">
        <header class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="m-0 text-base font-semibold">{{ section.title }}</h2>
            <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">{{ section.hint }}</p>
          </div>
          <button type="button" hlmBtn size="sm" (click)="create(section.kind)">+ {{ section.add }}</button>
        </header>

        <ul class="m-0 list-none p-0">
          @for (row of byKind(section.kind); track row.id) {
            <li class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3 last:border-b-0">
              <span
                class="size-2.5 shrink-0 rounded-full"
                [style.background]="dot(row)"
                [title]="state(row)"
              ></span>
              <div class="min-w-[220px] flex-1">
                <p class="m-0 flex items-center gap-2 text-[14px] font-medium">
                  {{ row.name }}
                  @if (row.source === 'env') {
                    <span hlmBadge variant="outline">.env</span>
                  }
                  @if (!row.enabled && row.source === 'ui') {
                    <span hlmBadge variant="secondary">Off</span>
                  }
                </p>
                <p class="m-0 mt-0.5 text-[12.5px] text-muted-foreground">
                  @if (row.kind === 'JIRA') {
                    {{ row.baseUrl ?? 'No site' }} · board {{ row.projectKey ?? '—' }} · {{ row.email ?? '—' }} ·
                    {{ row.tokenType }} token {{ row.secretHint ?? '' }}
                  } @else {
                    Webhook {{ row.secretHint ?? 'not set' }}
                  }
                </p>
              </div>
              <div class="min-w-[200px] text-[12.5px]">
                <p class="m-0" [style.color]="row.lastOk === false ? 'var(--color-overdue)' : null">
                  {{ state(row) }}
                </p>
                @if (row.lastDetail) {
                  <p class="m-0 mt-0.5 max-w-[360px] truncate text-muted-foreground" [title]="row.lastDetail">{{ row.lastDetail }}</p>
                }
              </div>
              <span class="w-[92px] text-[12.5px] text-muted-foreground">
                @if (row.source === 'env') {
                  Default
                } @else {
                  {{ row.projects }} project{{ row.projects === 1 ? '' : 's' }}
                }
              </span>
              <div class="flex gap-1.5">
                @if (row.source === 'ui') {
                  <button type="button" hlmBtn variant="outline" size="sm" [disabled]="busy() === row.id" (click)="test(row)">
                    {{ busy() === row.id ? 'Testing…' : 'Test' }}
                  </button>
                  <button type="button" hlmBtn variant="outline" size="sm" (click)="edit(row)">Edit</button>
                  <button type="button" hlmBtn variant="ghost" size="sm" class="text-destructive" (click)="remove(row)">Remove</button>
                } @else {
                  <span class="text-[12px] text-muted-foreground">Change it in the server .env</span>
                }
              </div>
            </li>
          }
        </ul>
      </section>
    }

    @if (draft(); as form) {
      <lime-modal
        [title]="(form.id ? 'Edit ' : 'Add ') + (form.kind === 'JIRA' ? 'Jira board' : 'Teams channel')"
        [subtitle]="form.kind === 'JIRA' ? 'The token is stored encrypted and never shown again.' : 'The webhook address is stored encrypted and never shown again.'"
        (dismiss)="draft.set(null)"
      >
        <form class="grid gap-4" (submit)="save($event)">
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Name
            <input hlmInput [(ngModel)]="form.name" name="name" required
              [placeholder]="form.kind === 'JIRA' ? 'DBANK Jira' : 'DBANK delivery channel'" />
          </label>

          @if (form.kind === 'JIRA') {
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Site address
              <input hlmInput type="url" [(ngModel)]="form.baseUrl" name="baseUrl" placeholder="https://your-team.atlassian.net" required />
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Account email
                <input hlmInput type="email" [(ngModel)]="form.email" name="email" required />
              </label>
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Default board (project key)
                <input hlmInput class="uppercase" [(ngModel)]="form.projectKey" name="projectKey" placeholder="OPS" required />
              </label>
            </div>
            <div class="grid gap-3 sm:grid-cols-[1fr_160px]">
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                API token
                <input hlmInput type="password" autocomplete="new-password" [(ngModel)]="form.secret" name="secret"
                  [placeholder]="form.id ? 'Leave empty to keep ' + (form.secretHint ?? 'the stored token') : 'Paste the API token'" />
              </label>
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Token type
                <select hlmInput [(ngModel)]="form.tokenType" name="tokenType">
                  <option value="scoped">Scoped</option>
                  <option value="classic">Classic</option>
                </select>
              </label>
            </div>
          } @else {
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Incoming webhook URL
              <input hlmInput type="password" autocomplete="off" [(ngModel)]="form.secret" name="secret"
                [placeholder]="form.id ? 'Leave empty to keep ' + (form.secretHint ?? 'the stored webhook') : 'https://….webhook.office.com/… or a Workflows URL'" />
            </label>
            <p class="m-0 text-[12.5px] text-muted-foreground">
              In Teams: channel ⋯ → Workflows → "Post to a channel when a webhook request is received", then copy the URL.
              Saving posts a short test message to the channel.
            </p>
          }

          <label class="flex items-center gap-2 text-[13px]">
            <input type="checkbox" [(ngModel)]="form.enabled" name="enabled" />
            Switched on
          </label>

          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="draft.set(null)">Cancel</button>
            <button type="submit" hlmBtn [disabled]="saving()">
              {{ saving() ? 'Saving and testing…' : form.id ? 'Save and test' : 'Add and test' }}
            </button>
          </div>
        </form>
      </lime-modal>
    }
  `,
})
export class Integrations {
  private readonly api = inject(Api);
  private readonly feedback = inject(Feedback);

  protected readonly sections = SECTIONS;
  protected readonly rows = signal<ApiIntegration[]>([]);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly byKind = (kind: IntegrationKind) => this.rows().filter((r) => r.kind === kind);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.api.integrations().subscribe({
      next: (rows) => this.rows.set(rows),
      error: (err) => this.feedback.failed(err, 'Could not load the connections.'),
    });
  }

  protected create(kind: IntegrationKind): void {
    this.draft.set({
      kind,
      name: '',
      baseUrl: '',
      email: '',
      projectKey: '',
      tokenType: 'scoped',
      secret: '',
      enabled: true,
      secretHint: null,
    });
  }

  protected edit(row: ApiIntegration): void {
    this.draft.set({
      id: row.id,
      kind: row.kind,
      name: row.name,
      baseUrl: row.baseUrl ?? '',
      email: row.email ?? '',
      projectKey: row.projectKey ?? '',
      tokenType: row.tokenType ?? 'scoped',
      secret: '',
      enabled: row.enabled,
      secretHint: row.secretHint,
    });
  }

  protected save(event: Event): void {
    event.preventDefault();
    const form = this.draft();
    if (!form) return;

    const body = {
      name: form.name.trim(),
      enabled: form.enabled,
      ...(form.secret.trim() ? { secret: form.secret.trim() } : {}),
      ...(form.kind === 'JIRA'
        ? {
            baseUrl: form.baseUrl.trim().replace(/\/+$/, ''),
            email: form.email.trim(),
            projectKey: form.projectKey.trim().toUpperCase(),
            tokenType: form.tokenType,
          }
        : {}),
    };

    this.saving.set(true);
    const request = form.id
      ? this.api.updateIntegration(form.id, body)
      : this.api.createIntegration({ ...body, kind: form.kind });

    request.subscribe({
      next: (row) => {
        this.saving.set(false);
        this.draft.set(null);
        this.load();
        this.api.integrationOptionsResource.reload();
        if (row.lastOk) this.feedback.success(`${row.name} is connected.`);
        else this.feedback.error(`${row.name} was saved, but the test failed: ${row.lastDetail ?? 'unknown error'}`);
      },
      error: (err) => {
        this.saving.set(false);
        this.feedback.failed(err, 'Could not save that connection.');
      },
    });
  }

  protected test(row: ApiIntegration): void {
    this.busy.set(row.id);
    this.api.testIntegration(row.id).subscribe({
      next: (result) => {
        this.busy.set(null);
        this.rows.update((rows) => rows.map((r) => (r.id === result.id ? result : r)));
        if (result.lastOk) this.feedback.success(`${result.name}: ${result.lastDetail}`);
        else this.feedback.error(`${result.name}: ${result.lastDetail}`);
      },
      error: (err) => {
        this.busy.set(null);
        this.feedback.failed(err, 'The test could not run.');
      },
    });
  }

  protected async remove(row: ApiIntegration): Promise<void> {
    const ok = await this.feedback.confirm({
      title: `Remove ${row.name}?`,
      message:
        row.projects > 0
          ? `${row.projects} project(s) use it. They will fall back to the server default.`
          : 'The stored credentials are deleted.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;

    this.api.deleteIntegration(row.id).subscribe({
      next: () => {
        this.load();
        this.api.integrationOptionsResource.reload();
        this.feedback.success(`${row.name} removed.`);
      },
      error: (err) => this.feedback.failed(err, 'Could not remove that connection.'),
    });
  }

  protected state(row: ApiIntegration): string {
    if (row.source === 'env') return row.enabled ? 'Configured in .env' : 'Not configured';
    if (!row.enabled) return 'Switched off';
    if (row.lastOk === null) return 'Not tested yet';
    const when = row.lastCheckedAt ? new Date(row.lastCheckedAt).toLocaleString() : '';
    return row.lastOk ? `Connected · checked ${when}` : `Failing · checked ${when}`;
  }

  protected dot(row: ApiIntegration): string {
    if (!row.enabled) return 'var(--muted-foreground)';
    if (row.source === 'env') return 'var(--color-good)';
    if (row.lastOk === null) return 'var(--color-soon)';
    return row.lastOk ? 'var(--color-good)' : 'var(--color-overdue)';
  }
}
