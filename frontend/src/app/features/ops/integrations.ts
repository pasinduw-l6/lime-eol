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
    hint: 'Each connection is a Jira site and a board. Projects pick one below; the rest use the one marked Default.',
    add: 'Add Jira board',
  },
  {
    kind: 'TEAMS',
    title: 'Teams channels',
    hint: 'An incoming webhook per channel. Projects pick one below; the rest use the one marked Default.',
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
                    <span hlmBadge variant="secondary">Inactive</span>
                  }
                  @if (row.isDefault) {
                    <span hlmBadge>Default</span>
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
              <span class="w-[120px] text-[12.5px] text-muted-foreground">{{ usage(row) }}</span>
              <div class="flex flex-wrap items-center gap-1.5">
                @if (row.source === 'ui') {
                  <label class="mr-1 flex items-center gap-1.5 text-[12.5px]" [title]="row.enabled ? 'Switch off' : 'Switch on'">
                    <input type="checkbox" class="size-4" [checked]="row.enabled" [disabled]="busy() === row.id" (change)="toggle(row)" />
                    Active
                  </label>
                }
                @if (!row.isDefault) {
                  <button type="button" hlmBtn variant="outline" size="sm" [disabled]="!row.enabled || busy() === row.id" (click)="makeDefault(row)">
                    Make default
                  </button>
                }
                @if (row.source === 'ui') {
                  <button type="button" hlmBtn variant="outline" size="sm" [disabled]="busy() === row.id" (click)="test(row)">
                    {{ busy() === row.id ? 'Testing…' : 'Test' }}
                  </button>
                  <button type="button" hlmBtn variant="outline" size="sm" (click)="edit(row)">Edit</button>
                  <button type="button" hlmBtn variant="ghost" size="sm" class="text-destructive" (click)="askRemove(row)">Remove</button>
                } @else {
                  <span class="text-[12px] text-muted-foreground">Set in the server .env</span>
                }
              </div>
            </li>
          }
        </ul>
      </section>
    }

    <section hlmCard class="mb-5 gap-0 p-0">
      <header class="border-b px-5 py-4">
        <h2 class="m-0 text-base font-semibold">Projects</h2>
        <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">
          Pick the Jira board and Teams channel each project uses. "Default" follows whichever connection is marked Default above.
        </p>
      </header>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr class="text-left text-[12px] text-muted-foreground">
              <th class="px-5 py-2 font-normal">Project</th>
              <th class="px-3 py-2 font-normal">Jira board</th>
              <th class="px-3 py-2 font-normal">Teams channel</th>
            </tr>
          </thead>
          <tbody>
            @for (p of api.projects(); track p.id) {
              <tr class="border-t">
                <td class="px-5 py-2.5">
                  <span class="block font-medium">{{ p.name }}</span>
                  <span class="block text-[12px] text-muted-foreground">{{ p.customer }} · {{ p.code }}</span>
                </td>
                <td class="px-3 py-2.5">
                  <select hlmInput class="h-8 min-w-[220px] py-0 text-[13px]" [attr.aria-label]="'Jira board for ' + p.name"
                    [disabled]="assigning() === p.id + 'JIRA'" (change)="assign(p.id, 'JIRA', $any($event.target).value)">
                    <option value="" [selected]="!p.jiraIntegrationId">Default ({{ defaultName('JIRA') }})</option>
                    @for (o of choices('JIRA', p.jiraIntegrationId); track o.id) {
                      <option [value]="o.id" [selected]="o.id === p.jiraIntegrationId">{{ o.name }}{{ o.enabled ? '' : ' (inactive)' }}</option>
                    }
                  </select>
                </td>
                <td class="px-3 py-2.5">
                  <select hlmInput class="h-8 min-w-[220px] py-0 text-[13px]" [attr.aria-label]="'Teams channel for ' + p.name"
                    [disabled]="assigning() === p.id + 'TEAMS'" (change)="assign(p.id, 'TEAMS', $any($event.target).value)">
                    <option value="" [selected]="!p.teamsIntegrationId">Default ({{ defaultName('TEAMS') }})</option>
                    @for (o of choices('TEAMS', p.teamsIntegrationId); track o.id) {
                      <option [value]="o.id" [selected]="o.id === p.teamsIntegrationId">{{ o.name }}{{ o.enabled ? '' : ' (inactive)' }}</option>
                    }
                  </select>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="3" class="px-5 py-6 text-center text-muted-foreground">No projects yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    @if (removing(); as r) {
      <lime-modal [title]="'Remove ' + r.row.name + '?'" (dismiss)="removing.set(null)">
        <form class="grid gap-4" (submit)="remove($event, r.row)">
          <p class="m-0 text-sm">The stored credentials are deleted. Jira issues already linked to plans keep their link.</p>
          @if (r.row.projects > 0) {
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              {{ r.row.projects }} project{{ r.row.projects === 1 ? ' uses' : 's use' }} it. Move {{ r.row.projects === 1 ? 'it' : 'them' }} to
              <select hlmInput [(ngModel)]="r.moveTo" name="moveTo">
                <option value="default">Default ({{ defaultName(r.row.kind, r.row.id) }})</option>
                @for (o of choices(r.row.kind, null); track o.id) {
                  @if (o.id !== r.row.id && o.enabled) {
                    <option [value]="o.id">{{ o.name }}</option>
                  }
                }
              </select>
            </label>
          }
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="removing.set(null)">Cancel</button>
            <button type="submit" hlmBtn variant="destructive">Remove</button>
          </div>
        </form>
      </lime-modal>
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
  protected readonly api = inject(Api);
  private readonly feedback = inject(Feedback);

  protected readonly sections = SECTIONS;
  protected readonly rows = signal<ApiIntegration[]>([]);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly removing = signal<{ row: ApiIntegration; moveTo: string } | null>(null);
  protected readonly assigning = signal<string | null>(null);

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

  protected askRemove(row: ApiIntegration): void {
    this.removing.set({ row, moveTo: 'default' });
  }

  protected remove(event: Event, row: ApiIntegration): void {
    event.preventDefault();
    const moveTo = this.removing()?.moveTo;
    this.removing.set(null);
    this.api.deleteIntegration(row.id, row.projects > 0 ? moveTo : undefined).subscribe({
      next: () => {
        this.refresh();
        this.feedback.success(`${row.name} removed.`);
      },
      error: (err) => this.feedback.failed(err, 'Could not remove that connection.'),
    });
  }

  protected toggle(row: ApiIntegration): void {
    this.busy.set(row.id);
    this.api.updateIntegration(row.id, { enabled: !row.enabled }).subscribe({
      next: (saved) => {
        this.busy.set(null);
        this.refresh();
        this.feedback.success(
          saved.enabled
            ? `${saved.name} is active.`
            : `${saved.name} is inactive. Its projects use the default until it is switched back on.`,
        );
      },
      error: (err) => {
        this.busy.set(null);
        this.feedback.failed(err, 'Could not change that connection.');
      },
    });
  }

  protected makeDefault(row: ApiIntegration): void {
    this.busy.set(row.id);
    this.api.makeIntegrationDefault(row.id).subscribe({
      next: (rows) => {
        this.busy.set(null);
        this.rows.set(rows);
        this.api.integrationOptionsResource.reload();
        this.feedback.success(`${row.name} is now the default ${row.kind === 'JIRA' ? 'Jira board' : 'Teams channel'}.`);
      },
      error: (err) => {
        this.busy.set(null);
        this.feedback.failed(err, 'Could not change the default.');
      },
    });
  }

  protected assign(projectId: string, kind: IntegrationKind, value: string): void {
    this.assigning.set(projectId + kind);
    const body = kind === 'JIRA' ? { jiraIntegrationId: value || null } : { teamsIntegrationId: value || null };
    this.api.updateProject(projectId, body).subscribe({
      next: (project) => {
        this.assigning.set(null);
        this.refresh();
        const name = value ? this.rows().find((r) => r.id === value)?.name : `the default (${this.defaultName(kind)})`;
        this.feedback.success(`${project.name} now uses ${name}.`);
      },
      error: (err) => {
        this.assigning.set(null);
        this.api.reload();
        this.feedback.failed(err, 'Could not change that project.');
      },
    });
  }

  /** Connections a project can pick: the active ones, plus its current one even if inactive. */
  protected choices(kind: IntegrationKind, current: string | null | undefined): ApiIntegration[] {
    return this.rows().filter((r) => r.kind === kind && r.source === 'ui' && (r.enabled || r.id === current));
  }

  /** Name of the default connection; when `leaving` is the default, the one that takes over (.env). */
  protected defaultName(kind: IntegrationKind, leaving?: string): string {
    const current = this.rows().find((r) => r.kind === kind && r.isDefault);
    if (!current || current.id === leaving) return 'server .env';
    return current.source === 'env' ? 'server .env' : current.name;
  }

  protected usage(row: ApiIntegration): string {
    const own = row.projects;
    const via = row.viaDefault;
    if (!own && !via) return 'Not used';
    const parts = [];
    if (own) parts.push(`${own} picked`);
    if (via) parts.push(`${via} by default`);
    return `${own + via} project${own + via === 1 ? '' : 's'} · ${parts.join(', ')}`;
  }

  private refresh(): void {
    this.load();
    this.api.integrationOptionsResource.reload();
    this.api.reload();
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
