import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { Api } from '../../core/api';
import { Feedback } from '../../core/feedback';

interface Found {
  branch: string;
  sha: string;
  url: string;
  at: string;
  dockerfile: string | null;
  packageJson: string | null;
  node: string | null;
  angular: string | null;
}

interface Source {
  projectId: string;
  repo: string;
  prodBranch: string;
  devBranch: string | null;
  dockerfilePath: string | null;
  packagePath: string | null;
  lastScanAt: string | null;
  status: 'NEVER' | 'OK' | 'WARN' | 'ERROR';
  message: string | null;
  found: Partial<Record<'PROD' | 'DEV', Found>>;
}

interface Status {
  configured: boolean;
  appId: string | null;
  org: string;
  appName: string | null;
  repositorySelection: string | null;
  repoCount: number | null;
  error: string | null;
  sources: Source[];
}

interface Proposal {
  id: string;
  project: string;
  technology: string;
  fromVersion: string | null;
  toVersion: string;
  branch: string;
  sha: string;
  commitUrl: string;
  commitMessage: string;
  commitAuthor: string;
  createdAt: string;
  remindAt: string;
  remindHours: number;
}

interface Repo {
  fullName: string;
  name: string;
  defaultBranch: string;
}

interface Draft {
  repo: string;
  prodBranch: string;
  devBranch: string;
}

const STATE: Record<Source['status'], string> = {
  NEVER: 'var(--muted-foreground)',
  OK: 'var(--color-good)',
  WARN: 'var(--color-soon)',
  ERROR: 'var(--color-overdue)',
};

/** Links each project to its GitHub repository and branches; Node.js and Angular are read from the code. */
@Component({
  selector: 'lime-source-code',
  imports: [HlmCardImports, HlmButton, HlmInput],
  host: { class: 'block' },
  template: `
    <section hlmCard class="mt-5 gap-0 py-0">
      <header class="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div class="min-w-0">
          <h2 class="m-0 text-base font-semibold">Source code (GitHub)</h2>
          <p class="m-0 mt-0.5 text-[13px] text-muted-foreground">
            Node.js comes from each project's Dockerfile and Angular from its package.json, read from the production branch
            into PROD every 15 minutes.
          </p>
          @if (status(); as s) {
            <p class="m-0 mt-1.5 text-[13px]">
              @if (!s.configured) {
                <span class="text-muted-foreground">Not set up. Add GITHUB_APP_ID and the private key on the server.</span>
              } @else if (s.error) {
                <span class="text-destructive">{{ s.error }}</span>
              } @else {
                <span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-full" style="background: var(--color-good)"></span>
                  {{ s.appName }} on {{ s.org }} · can read {{ s.repoCount }} repositor{{ s.repoCount === 1 ? 'y' : 'ies' }}</span>
              }
            </p>
          }
        </div>
        @if (status()?.configured) {
          <button type="button" hlmBtn size="sm" variant="outline" [disabled]="scanning()" (click)="scan()">
            {{ scanning() ? 'Scanning…' : 'Scan now' }}
          </button>
        }
      </header>

      @if (proposals().length) {
        <div class="border-b px-5 py-4" style="background: color-mix(in oklab, var(--color-soon) 8%, transparent)">
          <h3 class="m-0 mb-1 text-sm font-semibold">Waiting for approval · {{ proposals().length }}</h3>
          <p class="m-0 mb-3 text-[12.5px] text-muted-foreground">
            New versions on a production branch. Approve to record them in EOL; until then nothing changes and the Teams channel is reminded.
          </p>
          <ul class="m-0 grid list-none gap-2 p-0">
            @for (w of proposals(); track w.id) {
              <li class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3">
                <div class="min-w-[260px] flex-1">
                  <p class="m-0 text-[14px] font-medium">
                    {{ w.project }} · {{ w.technology }}
                    <span class="tabular text-muted-foreground">{{ w.fromVersion ?? 'none' }}</span> →
                    <span class="tabular font-semibold">{{ w.toVersion }}</span>
                  </p>
                  <p class="m-0 mt-0.5 text-[12.5px] text-muted-foreground">
                    {{ w.branch }} ·
                    <a [href]="w.commitUrl" target="_blank" rel="noopener" class="tabular text-primary hover:underline">{{ w.sha.slice(0, 7) }}</a>
                    "{{ w.commitMessage }}" by {{ w.commitAuthor }} · seen {{ ago(w.createdAt) }} · next reminder {{ when(w.remindAt) }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <select hlmInput class="h-8 w-auto py-0 text-[13px]" [attr.aria-label]="'Remind about ' + w.technology + ' for ' + w.project"
                    [disabled]="deciding() === w.id" (change)="remind(w, +$any($event.target).value); $any($event.target).value = ''">
                    <option value="">Remind me in…</option>
                    @for (o of remindOptions; track o.hours) {
                      <option [value]="o.hours">{{ o.label }}</option>
                    }
                  </select>
                  <button type="button" hlmBtn size="sm" [disabled]="deciding() === w.id" (click)="approve(w)">
                    {{ deciding() === w.id ? 'Saving…' : 'Approve' }}
                  </button>
                </div>
              </li>
            }
          </ul>
        </div>
      }

      @if (status()?.configured && !status()?.error) {
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-[13px]">
            <thead>
              <tr class="text-left text-[12px] text-muted-foreground">
                <th class="px-5 py-2 font-normal">Project</th>
                <th class="px-3 py-2 font-normal">Repository</th>
                <th class="px-3 py-2 font-normal">Production branch</th>
                <th class="px-3 py-2 font-normal">Found</th>
                <th class="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              @for (p of api.projects(); track p.id) {
                @let d = draftOf(p.id);
                @let s = sourceOf(p.id);
                <tr class="border-t align-top">
                  <td class="px-5 py-2.5">
                    <span class="block font-medium">{{ p.name }}</span>
                    <span class="block text-[12px] text-muted-foreground">{{ p.code }}</span>
                  </td>
                  <td class="px-3 py-2.5">
                    <select hlmInput class="h-8 min-w-[200px] py-0 text-[13px]" [attr.aria-label]="'Repository for ' + p.name" (change)="pickRepo(p.id, $any($event.target).value)">
                      <option value="" [selected]="!d.repo">Not linked</option>
                      @for (r of repos(); track r.fullName) {
                        <option [value]="r.fullName" [selected]="r.fullName === d.repo">{{ r.name }}</option>
                      }
                    </select>
                  </td>
                  <td class="px-3 py-2.5">
                    <select hlmInput class="h-8 min-w-[140px] py-0 text-[13px]" [disabled]="!d.repo" [attr.aria-label]="'Production branch for ' + p.name" (change)="set(p.id, 'prodBranch', $any($event.target).value)">
                      @for (b of branchesOf(d.repo); track b) {
                        <option [value]="b" [selected]="b === d.prodBranch">{{ b }}</option>
                      }
                    </select>
                  </td>
                  <td class="px-3 py-2.5 text-[12.5px]">
                    @if (s) {
                      @for (env of envs; track env) {
                        @if (s.found[env]; as f) {
                          <span class="block whitespace-nowrap">
                            <b>{{ env }}</b> · Node {{ f.node ?? '—' }} · Angular {{ f.angular ?? '—' }}
                            <a [href]="f.url" target="_blank" rel="noopener" class="tabular text-primary hover:underline">{{ f.sha.slice(0, 7) }}</a>
                          </span>
                        }
                      }
                      @if (s.message) {
                        <span class="mt-0.5 block max-w-[320px]" [style.color]="state[s.status]">{{ s.message }}</span>
                      }
                    } @else {
                      <span class="text-muted-foreground">—</span>
                    }
                  </td>
                  <td class="px-5 py-2.5 text-right whitespace-nowrap">
                    @if (dirty(p.id)) {
                      <button type="button" hlmBtn size="sm" [disabled]="!d.repo || !d.prodBranch || saving() === p.id" (click)="save(p.id)">
                        {{ saving() === p.id ? 'Reading…' : 'Save' }}
                      </button>
                    } @else if (s) {
                      <button type="button" hlmBtn size="sm" variant="ghost" class="text-destructive" (click)="unlink(p.id, p.name)">Unlink</button>
                    }
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
export class SourceCode {
  protected readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(Feedback);

  protected readonly envs = ['PROD'] as const;
  protected readonly state = STATE;
  protected readonly status = signal<Status | null>(null);
  protected readonly repos = signal<Repo[]>([]);
  private readonly branches = signal<Record<string, string[]>>({});
  private readonly drafts = signal<Record<string, Draft>>({});
  protected readonly saving = signal<string | null>(null);
  protected readonly scanning = signal(false);
  protected readonly proposals = signal<Proposal[]>([]);
  protected readonly deciding = signal<string | null>(null);
  protected readonly remindOptions = [
    { hours: 2, label: "2 hours" },
    { hours: 12, label: "12 hours" },
    { hours: 24, label: "1 day" },
    { hours: 72, label: "3 days" },
    { hours: 168, label: "7 days" },
  ];

  private readonly saved = computed(() => {
    const map: Record<string, Draft> = {};
    for (const s of this.status()?.sources ?? []) map[s.projectId] = { repo: s.repo, prodBranch: s.prodBranch, devBranch: s.devBranch ?? '' };
    return map;
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.http.get<Status>('/api/v1/source-code').subscribe({
      next: (s) => {
        this.status.set(s);
        if (s.configured && !s.error) {
          this.http.get<Repo[]>('/api/v1/source-code/repos').subscribe({ next: (r) => this.repos.set(r) });
          for (const src of s.sources) this.loadBranches(src.repo);
          this.loadProposals();
        }
      },
      error: (err) => this.feedback.failed(err, 'Could not load the GitHub connection.'),
    });
  }

  private loadBranches(repo: string): void {
    if (!repo || this.branches()[repo]) return;
    this.http.get<string[]>('/api/v1/source-code/branches', { params: { repo } }).subscribe({
      next: (list) => {
        this.branches.update((all) => ({ ...all, [repo]: list }));
        // A freshly picked repository starts on its default branch, plus "development"/"develop" when present.
        for (const [projectId, d] of Object.entries(this.drafts())) {
          if (d.repo !== repo || d.prodBranch) continue;
          const def = this.repos().find((r) => r.fullName === repo)?.defaultBranch ?? list[0] ?? '';
          const dev = '';
          this.drafts.update((all) => ({ ...all, [projectId]: { ...d, prodBranch: def, devBranch: dev } }));
        }
      },
      error: (err) => this.feedback.failed(err, `Could not read the branches of ${repo}.`),
    });
  }

  protected draftOf(projectId: string): Draft {
    return this.drafts()[projectId] ?? this.saved()[projectId] ?? { repo: '', prodBranch: '', devBranch: '' };
  }

  protected sourceOf(projectId: string): Source | undefined {
    return this.status()?.sources.find((s) => s.projectId === projectId);
  }

  protected branchesOf(repo: string): string[] {
    return repo ? (this.branches()[repo] ?? []) : [];
  }

  protected dirty(projectId: string): boolean {
    const d = this.drafts()[projectId];
    if (!d) return false;
    const s = this.saved()[projectId] ?? { repo: '', prodBranch: '', devBranch: '' };
    return d.repo !== s.repo || d.prodBranch !== s.prodBranch || d.devBranch !== s.devBranch;
  }

  protected pickRepo(projectId: string, repo: string): void {
    this.drafts.update((all) => ({ ...all, [projectId]: { repo, prodBranch: '', devBranch: '' } }));
    this.loadBranches(repo);
    if (repo && this.branches()[repo]) {
      const list = this.branches()[repo];
      const def = this.repos().find((r) => r.fullName === repo)?.defaultBranch ?? list[0] ?? '';
      const dev = '';
      this.drafts.update((all) => ({ ...all, [projectId]: { repo, prodBranch: def, devBranch: dev } }));
    }
  }

  protected set(projectId: string, field: 'prodBranch' | 'devBranch', value: string): void {
    this.drafts.update((all) => ({ ...all, [projectId]: { ...this.draftOf(projectId), [field]: value } }));
  }

  protected save(projectId: string): void {
    const d = this.draftOf(projectId);
    if (!d.repo) {
      const linked = this.sourceOf(projectId);
      if (linked) this.unlink(projectId, linked.repo);
      return;
    }
    this.saving.set(projectId);
    this.http
      .put<Source>(`/api/v1/source-code/projects/${projectId}`, { repo: d.repo, prodBranch: d.prodBranch, devBranch: d.devBranch || null })
      .subscribe({
        next: (s) => {
          this.saving.set(null);
          this.drafts.update(({ [projectId]: _, ...rest }) => rest);
          this.status.update((st) => (st ? { ...st, sources: [...st.sources.filter((x) => x.projectId !== projectId), s] } : st));
          this.api.reload();
          if (s.status === 'ERROR') this.feedback.error(s.message ?? 'Could not read the repository.');
          else this.feedback.success(s.message ?? 'Linked.');
        },
        error: (err) => {
          this.saving.set(null);
          this.feedback.failed(err, 'Could not link that repository.');
        },
      });
  }

  protected async unlink(projectId: string, name: string): Promise<void> {
    const ok = await this.feedback.confirm({
      title: `Stop reading versions from GitHub for ${name}?`,
      message: 'The versions already recorded stay, and can be edited by hand again.',
      confirmLabel: 'Unlink',
      destructive: true,
    });
    if (!ok) return;
    this.http.delete(`/api/v1/source-code/projects/${projectId}`).subscribe({
      next: () => {
        this.drafts.update(({ [projectId]: _, ...rest }) => rest);
        this.status.update((st) => (st ? { ...st, sources: st.sources.filter((x) => x.projectId !== projectId) } : st));
        this.feedback.success('Unlinked.');
      },
      error: (err) => this.feedback.failed(err, 'Could not unlink.'),
    });
  }

  protected scan(): void {
    this.scanning.set(true);
    this.http.post<Status>('/api/v1/source-code/scan', {}).subscribe({
      next: (s) => {
        this.scanning.set(false);
        this.status.set(s);
        this.api.reload();
        this.loadProposals();
        this.feedback.success('Scan finished.');
      },
      error: (err) => {
        this.scanning.set(false);
        this.feedback.failed(err, 'The scan could not run.');
      },
    });
  }

  private loadProposals(): void {
    this.http.get<Proposal[]>('/api/v1/source-code/proposals').subscribe({
      next: (list) => this.proposals.set(list),
      error: (err) => this.feedback.failed(err, 'Could not load the versions waiting for approval.'),
    });
  }

  protected approve(w: Proposal): void {
    this.deciding.set(w.id);
    this.http.post(`/api/v1/source-code/proposals/${w.id}/approve`, {}).subscribe({
      next: () => {
        this.deciding.set(null);
        this.proposals.update((list) => list.filter((x) => x.id !== w.id));
        this.api.reload();
        this.feedback.success(`${w.project}: ${w.technology} ${w.toVersion} recorded.`);
      },
      error: (err) => {
        this.deciding.set(null);
        this.feedback.failed(err, 'Could not approve that version.');
      },
    });
  }

  protected remind(w: Proposal, hours: number): void {
    if (!hours) return;
    const label = this.remindOptions.find((o) => o.hours === hours)?.label ?? `${hours} hours`;
    this.deciding.set(w.id);
    this.http.post(`/api/v1/source-code/proposals/${w.id}/remind`, { hours }).subscribe({
      next: () => {
        this.deciding.set(null);
        this.loadProposals();
        this.feedback.success(`The channel is reminded in ${label}, then every ${label} until it is approved.`);
      },
      error: (err) => {
        this.deciding.set(null);
        this.feedback.failed(err, 'Could not set the reminder.');
      },
    });
  }

  protected ago(iso: string): string {
    const hours = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours} h ago`;
    return `${Math.round(hours / 24)} d ago`;
  }

  protected when(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
