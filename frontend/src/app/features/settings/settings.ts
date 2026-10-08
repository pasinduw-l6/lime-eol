import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { Api, ApiTeam, ApiUser } from '../../core/api';
import { Feedback } from '../../core/feedback';
import { ROLES, ROLE_INFO, RoleName } from '../../core/permissions';
import { SessionStore } from '../../core/session';
import { Modal } from '../../shared/modal';

type Tab = 'users' | 'teams';

interface TeamDraft {
  id?: string;
  name: string;
  email: string;
  memberIds: string[];
}

@Component({
  selector: 'lime-settings',
  imports: [
    FormsModule,
    HlmBadgeImports,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmLabel,
    HlmTableImports,
    Modal,
  ],
  host: { class: 'block' },
  template: `
    <header class="mb-6">
      <h1 class="m-0 text-3xl font-semibold tracking-tight">Settings</h1>
      <p class="m-0 mt-1 text-sm text-muted-foreground">Who can do what, and the teams that own environments.</p>
    </header>

    <nav class="segmented mb-6" aria-label="Settings sections">
      @for (t of tabs; track t.key) {
        <button
          type="button"
          class="px-4 py-1 text-sm"
          [class.bg-background]="tab() === t.key"
          [class.shadow-sm]="tab() === t.key"
          [class.text-foreground]="tab() === t.key"
          [attr.aria-current]="tab() === t.key"
          (click)="tab.set(t.key)"
        >
          {{ t.label }}
        </button>
      }
    </nav>

    @if (tab() === 'users') {
      <section hlmCard class="mb-5" aria-labelledby="invite">
        <div hlmCardHeader>
          <h2 hlmCardTitle id="invite">Add a person</h2>
          <p hlmCardDescription>
            They sign in with Microsoft as usual and get this role. People who sign in without being added
            become Viewers.
          </p>
        </div>
        <form hlmCardContent class="grid gap-3 md:grid-cols-[1fr_1fr_200px_auto] md:items-end" (submit)="invite($event)">
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Work email
            <input hlmInput type="email" name="email" [(ngModel)]="inviteEmail" placeholder="nimal@linearsix.com" />
          </label>
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Name
            <input hlmInput name="name" [(ngModel)]="inviteName" placeholder="Nimal Perera" />
          </label>
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Role
            <select hlmInput name="role" [(ngModel)]="inviteRole">
              @for (r of roles; track r) {
                <option [value]="r">{{ roleInfo[r].label }}</option>
              }
            </select>
          </label>
          <button type="submit" hlmBtn [disabled]="busy()">Add person</button>
        </form>
      </section>

      <section hlmCard aria-labelledby="people">
        <div hlmCardHeader>
          <h2 hlmCardTitle id="people">People</h2>
          <p hlmCardDescription>{{ activeCount() }} active · role changes apply on the person's next action</p>
          <div hlmCardAction>
            <label class="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" [checked]="showInactive()" (change)="showInactive.set(!showInactive())" />
              Show deactivated
            </label>
          </div>
        </div>
        <div hlmCardContent class="overflow-x-auto px-0">
          <table hlmTable class="w-full">
            <thead hlmTHead>
              <tr hlmTr>
                <th hlmTh class="pl-6">Person</th>
                <th hlmTh>Role</th>
                <th hlmTh>Teams</th>
                <th hlmTh>Projects</th>
                <th hlmTh>Last sign-in</th>
                <th hlmTh class="pr-6"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody hlmTBody>
              @for (u of visibleUsers(); track u.id) {
                <tr hlmTr [class.opacity-60]="!u.isActive">
                  <td hlmTd class="pl-6">
                    <span class="block font-medium">{{ u.name }}</span>
                    <span class="block text-xs text-muted-foreground">{{ u.email }}</span>
                  </td>
                  <td hlmTd>
                    <select
                      hlmInput
                      class="h-8 w-[210px]"
                      [value]="u.role"
                      [disabled]="!u.isActive || busy()"
                      [attr.aria-label]="'Role for ' + u.name"
                      (change)="changeRole(u, $any($event.target).value)"
                    >
                      @for (r of roles; track r) {
                        <option [value]="r">{{ roleInfo[r].label }}</option>
                      }
                    </select>
                  </td>
                  <td hlmTd class="whitespace-normal">
                    <span class="flex flex-wrap gap-1">
                      @for (t of u.teams; track t.id) {
                        <span hlmBadge variant="secondary">{{ t.name }}</span>
                      } @empty {
                        <span class="text-muted-foreground">—</span>
                      }
                    </span>
                  </td>
                  <td hlmTd class="tabular">{{ u.projectCount }}</td>
                  <td hlmTd class="tabular text-muted-foreground">{{ when(u.lastLoginAt) }}</td>
                  <td hlmTd class="pr-6 text-right">
                    @if (u.isActive) {
                      <button
                        type="button"
                        hlmBtn
                        variant="ghost"
                        size="sm"
                        class="text-destructive"
                        [disabled]="busy() || u.id === me()"
                        (click)="setActive(u, false)"
                      >
                        Deactivate
                      </button>
                    } @else {
                      <button type="button" hlmBtn variant="outline" size="sm" [disabled]="busy()" (click)="setActive(u, true)">
                        Reactivate
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section hlmCard class="mt-5" aria-labelledby="roles">
        <div hlmCardHeader>
          <h2 hlmCardTitle id="roles">What each role can do</h2>
          <p hlmCardDescription>From the end-of-life handling process. Everyone can view everything.</p>
        </div>
        <div hlmCardContent>
          <dl class="m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (r of roles; track r) {
              <div class="rounded-lg border p-3">
                <dt class="text-sm font-medium">{{ roleInfo[r].label }}</dt>
                <dd class="m-0 mt-0.5 text-sm text-muted-foreground">{{ roleInfo[r].description }}</dd>
              </div>
            }
          </dl>
        </div>
      </section>
    } @else {
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" hlmBtn (click)="newTeam()">New team</button>
        <label class="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" [checked]="showArchivedTeams()" (change)="toggleArchivedTeams()" />
          Show archived
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        @for (t of api.teams(); track t.id) {
          <article hlmCard class="gap-4 py-5">
            <div class="flex items-start justify-between gap-3 px-5">
              <div class="min-w-0">
                <h3 class="m-0 truncate text-base font-semibold">{{ t.name }}</h3>
                <p class="m-0 text-xs text-muted-foreground">{{ t.email || 'No team email' }}</p>
              </div>
              <span class="flex gap-1">
                <button type="button" hlmBtn variant="ghost" size="sm" (click)="editTeam(t)">Edit</button>
                <button type="button" hlmBtn variant="ghost" size="sm" class="text-destructive" (click)="archiveTeam(t)">Archive</button>
              </span>
            </div>
            <div class="px-5">
              <p class="m-0 mb-1.5 text-xs text-muted-foreground">Members</p>
              <div class="flex flex-wrap gap-1">
                @for (m of t.members; track m.id) {
                  <span hlmBadge variant="secondary">{{ m.name }}</span>
                } @empty {
                  <span class="text-sm text-muted-foreground">No members yet</span>
                }
              </div>
            </div>
            <div class="border-t px-5 pt-4">
              <p class="m-0 mb-1.5 text-xs text-muted-foreground">Owns</p>
              <div class="flex flex-wrap gap-1">
                @for (e of t.environments; track e.id) {
                  <span hlmBadge variant="outline">{{ e.name }}{{ e.isPrimary ? ' · primary' : '' }}</span>
                } @empty {
                  <span class="text-sm text-muted-foreground">No environments. Set owners from Projects → Manage.</span>
                }
              </div>
            </div>
          </article>
        } @empty {
          <p class="m-0 text-sm text-muted-foreground">No teams yet.</p>
        }
      </div>

      @if (showArchivedTeams()) {
        <section hlmCard class="mt-5" aria-labelledby="archived-teams">
          <div hlmCardHeader>
            <h2 hlmCardTitle id="archived-teams">Archived teams</h2>
          </div>
          <div hlmCardContent>
            <ul class="m-0 grid list-none gap-2 p-0">
              @for (t of archivedTeams(); track t.id) {
                <li class="flex items-center justify-between gap-3 rounded-md border px-4 py-2 text-sm">
                  {{ t.name }}
                  <button type="button" hlmBtn variant="outline" size="sm" (click)="restoreTeam(t)">Restore</button>
                </li>
              } @empty {
                <li class="text-sm text-muted-foreground">Nothing archived.</li>
              }
            </ul>
          </div>
        </section>
      }
    }

    @if (teamDraft(); as draft) {
      <lime-modal [title]="draft.id ? 'Edit team' : 'New team'" (dismiss)="teamDraft.set(null)">
        <form class="grid gap-4" (submit)="saveTeam($event)">
          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Name
              <input hlmInput name="name" [(ngModel)]="draft.name" placeholder="SRE / DevOps" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Team email
              <input hlmInput type="email" name="email" [(ngModel)]="draft.email" placeholder="sre@linearsix.com" />
            </label>
          </div>
          <fieldset class="m-0 border-0 p-0">
            <legend class="mb-2 p-0 text-sm">Members</legend>
            <div class="flex max-h-[220px] flex-wrap gap-2 overflow-y-auto">
              @for (u of activeUsers(); track u.id) {
                <button
                  type="button"
                  class="rounded-md border px-3 py-1.5 text-sm transition-colors"
                  [class.border-primary]="draft.memberIds.includes(u.id)"
                  [style.background]="draft.memberIds.includes(u.id) ? 'color-mix(in oklab, var(--primary) 12%, transparent)' : ''"
                  [attr.aria-pressed]="draft.memberIds.includes(u.id)"
                  (click)="toggleMember(draft, u.id)"
                >
                  {{ u.name }}
                </button>
              }
            </div>
          </fieldset>
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="teamDraft.set(null)">Cancel</button>
            <button type="submit" hlmBtn [disabled]="busy()">{{ draft.id ? 'Save changes' : 'Create team' }}</button>
          </div>
        </form>
      </lime-modal>
    }
  `,
})
export class Settings {
  protected readonly api = inject(Api);
  private readonly feedback = inject(Feedback);
  private readonly session = inject(SessionStore);

  protected readonly tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Users & roles' },
    { key: 'teams', label: 'Teams' },
  ];
  protected readonly tab = signal<Tab>('users');
  protected readonly roles = ROLES;
  protected readonly roleInfo = ROLE_INFO;
  protected readonly busy = signal(false);
  protected readonly me = computed(() => this.session.user()?.id);

  protected readonly users = signal<ApiUser[]>([]);
  protected readonly showInactive = signal(false);
  protected readonly visibleUsers = computed(() =>
    this.users().filter((u) => this.showInactive() || u.isActive),
  );
  protected readonly activeUsers = computed(() => this.users().filter((u) => u.isActive));
  protected readonly activeCount = computed(() => this.activeUsers().length);

  protected inviteEmail = '';
  protected inviteName = '';
  protected inviteRole: RoleName = 'VIEWER';

  protected readonly teamDraft = signal<TeamDraft | null>(null);
  protected readonly showArchivedTeams = signal(false);
  protected readonly archivedTeams = signal<ApiTeam[]>([]);

  constructor() {
    this.loadUsers();
  }

  private loadUsers(): void {
    this.api.allUsers().subscribe({
      next: (users) => this.users.set(users),
      error: (err) => this.feedback.failed(err, 'Could not load people.'),
    });
  }

  protected invite(event: Event): void {
    event.preventDefault();
    if (!this.inviteEmail.trim()) {
      this.feedback.error('Enter a work email.');
      return;
    }
    this.busy.set(true);
    this.api
      .inviteUser({
        email: this.inviteEmail.trim(),
        displayName: this.inviteName.trim() || undefined,
        role: this.inviteRole,
      })
      .subscribe({
        next: (user) => {
          this.busy.set(false);
          this.inviteEmail = '';
          this.inviteName = '';
          this.feedback.success(`${user.name} added as ${ROLE_INFO[user.role].label}.`);
          this.refresh();
        },
        error: (err) => {
          this.busy.set(false);
          this.feedback.failed(err, 'Could not add that person.');
        },
      });
  }

  protected changeRole(user: ApiUser, role: RoleName): void {
    if (role === user.role) return;
    this.busy.set(true);
    this.api.updateUser(user.id, { role }).subscribe({
      next: () => {
        this.busy.set(false);
        this.feedback.success(`${user.name} is now ${ROLE_INFO[role].label}.`);
        this.refresh();
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'Could not change that role.');
        this.loadUsers();
      },
    });
  }

  protected async setActive(user: ApiUser, isActive: boolean): Promise<void> {
    if (
      !isActive &&
      !(await this.feedback.confirm({
        title: `Deactivate ${user.name}?`,
        message: 'They are signed out on their next action and cannot sign in again until reactivated.',
        confirmLabel: 'Deactivate',
        destructive: true,
      }))
    ) {
      return;
    }

    this.busy.set(true);
    this.api.updateUser(user.id, { isActive }).subscribe({
      next: () => {
        this.busy.set(false);
        this.feedback.success(`${user.name} ${isActive ? 'reactivated' : 'deactivated'}.`);
        this.refresh();
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'Could not change that account.');
      },
    });
  }

  protected newTeam(): void {
    this.teamDraft.set({ name: '', email: '', memberIds: [] });
  }

  protected editTeam(team: ApiTeam): void {
    this.teamDraft.set({
      id: team.id,
      name: team.name,
      email: team.email ?? '',
      memberIds: team.members.map((m) => m.id),
    });
  }

  protected toggleMember(draft: TeamDraft, id: string): void {
    draft.memberIds = draft.memberIds.includes(id)
      ? draft.memberIds.filter((m) => m !== id)
      : [...draft.memberIds, id];
  }

  protected saveTeam(event: Event): void {
    event.preventDefault();
    const draft = this.teamDraft();
    if (!draft?.name.trim()) {
      this.feedback.error('A team needs a name.');
      return;
    }

    const body = { name: draft.name.trim(), email: draft.email.trim() || null, memberIds: draft.memberIds };
    this.busy.set(true);
    (draft.id ? this.api.updateTeam(draft.id, body) : this.api.createTeam(body)).subscribe({
      next: (team) => {
        this.busy.set(false);
        this.teamDraft.set(null);
        this.feedback.success(`${team.name} saved.`);
        this.refresh();
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'Could not save that team.');
      },
    });
  }

  protected async archiveTeam(team: ApiTeam): Promise<void> {
    const ok = await this.feedback.confirm({
      title: `Archive ${team.name}?`,
      message: 'It disappears from pickers. You can restore it later.',
      confirmLabel: 'Archive',
      destructive: true,
    });
    if (!ok) return;

    this.api.archiveTeam(team.id).subscribe({
      next: () => {
        this.feedback.success(`${team.name} archived.`, {
          label: 'Undo',
          run: () => this.restoreTeam(team),
        });
        this.refresh();
      },
      error: (err) => this.feedback.failed(err, 'Could not archive that team.'),
    });
  }

  protected restoreTeam(team: ApiTeam): void {
    this.api.restoreTeam(team.id).subscribe({
      next: () => {
        this.feedback.success(`${team.name} restored.`);
        this.refresh();
      },
      error: (err) => this.feedback.failed(err, 'Could not restore that team.'),
    });
  }

  protected toggleArchivedTeams(): void {
    this.showArchivedTeams.update((v) => !v);
    if (this.showArchivedTeams()) this.loadArchivedTeams();
  }

  private loadArchivedTeams(): void {
    this.api.archivedTeams().subscribe({
      next: (teams) => this.archivedTeams.set(teams),
      error: (err) => this.feedback.failed(err, 'Could not load archived teams.'),
    });
  }

  private refresh(): void {
    this.loadUsers();
    this.api.reload();
    if (this.showArchivedTeams()) this.loadArchivedTeams();
  }

  protected when(value: string | null): string {
    return value
      ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Never';
  }
}
