import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { Api, ApiCompatibilityOption, ApiLimeRelease } from '../../core/api';
import { Feedback } from '../../core/feedback';
import { parseDate, today } from '../../core/lifecycle';
import { SessionStore } from '../../core/session';
import { Modal } from '../../shared/modal';

interface Draft {
  id?: string;
  version: string;
  releaseDate: string;
  supportEnd: string;
  notes: string;
}

@Component({
  selector: 'lime-lime-releases',
  imports: [FormsModule, HlmBadgeImports, HlmButton, HlmCardImports, HlmInput, HlmLabel, Modal],
  host: { class: 'block' },
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="m-0 text-sm text-muted-foreground">
        Each release is supported for four years by default. The Overview's support ring reads these dates.
      </p>
      @if (canWrite()) {
        <button type="button" hlmBtn (click)="add()">New Lime release</button>
      }
    </div>

    <div class="grid gap-4">
      @for (r of releases(); track r.id) {
        <article hlmCard class="gap-4 py-5">
          <div class="flex flex-wrap items-start justify-between gap-3 px-6">
            <div>
              <h3 class="m-0 text-lg font-semibold">Lime {{ r.version }}</h3>
              <p class="tabular m-0 text-sm text-muted-foreground">
                Released {{ date(r.releaseDate) }} · supported until {{ date(r.supportEnd) }}
                <span [class.text-destructive]="ended(r)">({{ remaining(r) }})</span>
              </p>
            </div>
            @if (canWrite()) {
              <span class="flex gap-1">
                <button type="button" hlmBtn variant="ghost" size="sm" (click)="edit(r)">Edit</button>
                <button type="button" hlmBtn variant="ghost" size="sm" (click)="openCompatibility(r)">Compatibility</button>
                <button type="button" hlmBtn variant="ghost" size="sm" class="text-destructive" (click)="remove(r)">Delete</button>
              </span>
            }
          </div>

          @if (r.releaseDate && r.supportEnd) {
            <div class="px-6">
              <div class="h-2 overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full" [style.width.%]="used(r)" [style.background]="ended(r) ? 'var(--destructive)' : 'var(--primary)'"></div>
              </div>
            </div>
          }

          <div class="grid gap-4 border-t px-6 pt-4 md:grid-cols-[1fr_2fr]">
            <div>
              <p class="m-0 mb-1.5 text-xs text-muted-foreground">In use</p>
              <p class="m-0 text-sm">{{ r.environments }} environments</p>
              <div class="mt-1 flex flex-wrap gap-1">
                @for (p of r.projects; track p) {
                  <span hlmBadge variant="secondary">{{ p }}</span>
                }
              </div>
            </div>
            <div>
              <p class="m-0 mb-1.5 text-xs text-muted-foreground">Compatible versions (confirmed by Product / Engineering)</p>
              <div class="flex flex-wrap gap-1">
                @for (c of r.compatibility; track c.techVersionId) {
                  <span hlmBadge variant="outline">{{ c.technology }} {{ c.version }}</span>
                } @empty {
                  <span class="text-sm text-muted-foreground">Not confirmed yet.</span>
                }
              </div>
            </div>
          </div>

          @if (r.notes) {
            <p class="m-0 border-t px-6 pt-4 text-sm text-muted-foreground">{{ r.notes }}</p>
          }
        </article>
      } @empty {
        <p class="m-0 text-sm text-muted-foreground">No Lime releases yet.</p>
      }
    </div>

    @if (draft(); as d) {
      <lime-modal [title]="d.id ? 'Edit Lime ' + d.version : 'New Lime release'" (dismiss)="draft.set(null)">
        <form class="grid gap-4" (submit)="save($event)">
          <div class="grid gap-3 sm:grid-cols-3">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Version
              <input hlmInput class="tabular" name="version" [(ngModel)]="d.version" placeholder="3.0" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Released
              <input hlmInput type="date" name="released" [(ngModel)]="d.releaseDate" (ngModelChange)="suggestEnd(d)" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Supported until
              <input hlmInput type="date" name="end" [(ngModel)]="d.supportEnd" />
            </label>
          </div>
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Notes
            <textarea hlmInput rows="3" class="h-auto py-2" name="notes" [(ngModel)]="d.notes"></textarea>
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="draft.set(null)">Cancel</button>
            <button type="submit" hlmBtn [disabled]="busy()">{{ d.id ? 'Save changes' : 'Create release' }}</button>
          </div>
        </form>
      </lime-modal>
    }

    @if (compat(); as c) {
      <lime-modal [title]="'Lime ' + c.release.version + ' compatibility'" subtitle="Pick every version this release is confirmed to work with." [maxWidth]="760" (dismiss)="compat.set(null)">
        <div class="grid max-h-[60vh] gap-4 overflow-y-auto">
          @for (t of options(); track t.technology) {
            <fieldset class="m-0 rounded-lg border p-3">
              <legend class="px-1 text-sm font-medium">{{ t.technology }}</legend>
              <div class="flex flex-wrap gap-1.5">
                @for (v of t.versions; track v.id) {
                  <button
                    type="button"
                    class="tabular rounded-md border px-2 py-1 text-xs transition-colors"
                    [class.border-primary]="c.selected.has(v.id)"
                    [style.background]="c.selected.has(v.id) ? 'color-mix(in oklab, var(--primary) 14%, transparent)' : ''"
                    [attr.aria-pressed]="c.selected.has(v.id)"
                    (click)="toggle(v.id)"
                  >
                    {{ v.version }}
                  </button>
                }
              </div>
            </fieldset>
          }
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" hlmBtn variant="outline" (click)="compat.set(null)">Cancel</button>
          <button type="button" hlmBtn [disabled]="busy()" (click)="saveCompatibility()">Save {{ c.selected.size }} versions</button>
        </div>
      </lime-modal>
    }
  `,
})
export class LimeReleases {
  private readonly api = inject(Api);
  private readonly feedback = inject(Feedback);
  private readonly session = inject(SessionStore);

  protected readonly canWrite = computed(() => this.session.can('lime:write'));
  protected readonly releases = signal<ApiLimeRelease[]>([]);
  protected readonly options = signal<ApiCompatibilityOption[]>([]);
  protected readonly busy = signal(false);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly compat = signal<{ release: ApiLimeRelease; selected: Set<string> } | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.api.limeReleases().subscribe({
      next: (rows) => this.releases.set(rows),
      error: (err) => this.feedback.failed(err, 'Could not load Lime releases.'),
    });
  }

  protected date(value: string | null): string {
    const d = parseDate(value);
    return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'not set';
  }

  protected ended(r: ApiLimeRelease): boolean {
    const end = parseDate(r.supportEnd);
    return !!end && end.getTime() <= today().getTime();
  }

  protected remaining(r: ApiLimeRelease): string {
    const end = parseDate(r.supportEnd);
    if (!end) return 'no end date';
    const days = Math.round((end.getTime() - today().getTime()) / 86_400_000);
    if (days <= 0) return 'support ended';
    return days >= 365 ? `${(days / 365.25).toFixed(1)} years left` : `${days} days left`;
  }

  protected used(r: ApiLimeRelease): number {
    const start = parseDate(r.releaseDate)!.getTime();
    const end = parseDate(r.supportEnd)!.getTime();
    return Math.min(100, Math.max(0, ((today().getTime() - start) / Math.max(1, end - start)) * 100));
  }

  protected add(): void {
    this.draft.set({ version: '', releaseDate: '', supportEnd: '', notes: '' });
  }

  protected edit(r: ApiLimeRelease): void {
    this.draft.set({
      id: r.id,
      version: r.version,
      releaseDate: r.releaseDate ?? '',
      supportEnd: r.supportEnd ?? '',
      notes: r.notes ?? '',
    });
  }

  protected suggestEnd(d: Draft): void {
    const start = parseDate(d.releaseDate);
    if (start && !d.supportEnd) {
      d.supportEnd = new Date(Date.UTC(start.getUTCFullYear() + 4, start.getUTCMonth(), start.getUTCDate()))
        .toISOString()
        .slice(0, 10);
    }
  }

  protected save(event: Event): void {
    event.preventDefault();
    const d = this.draft();
    if (!d?.version.trim()) {
      this.feedback.error('A release needs a version, such as 3.0.');
      return;
    }
    const body = {
      version: d.version.trim(),
      releaseDate: d.releaseDate || null,
      supportEnd: d.supportEnd || null,
      notes: d.notes.trim() || null,
    };
    this.busy.set(true);
    (d.id ? this.api.updateLimeRelease(d.id, body) : this.api.createLimeRelease(body)).subscribe({
      next: () => {
        this.busy.set(false);
        this.draft.set(null);
        this.feedback.success(`Lime ${body.version} saved.`);
        this.load();
        this.api.reload();
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'Could not save that release.');
      },
    });
  }

  protected openCompatibility(r: ApiLimeRelease): void {
    this.compat.set({ release: r, selected: new Set(r.compatibility.map((c) => c.techVersionId)) });
    if (this.options().length === 0) {
      this.api.compatibilityOptions().subscribe({
        next: (rows) => this.options.set(rows),
        error: (err) => this.feedback.failed(err, 'Could not load technology versions.'),
      });
    }
  }

  protected toggle(id: string): void {
    const c = this.compat();
    if (!c) return;
    const selected = new Set(c.selected);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.compat.set({ ...c, selected });
  }

  protected saveCompatibility(): void {
    const c = this.compat();
    if (!c) return;
    this.busy.set(true);
    this.api.setLimeCompatibility(c.release.id, [...c.selected]).subscribe({
      next: () => {
        this.busy.set(false);
        this.compat.set(null);
        this.feedback.success(`Compatibility for Lime ${c.release.version} saved.`);
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'Could not save compatibility.');
      },
    });
  }

  protected async remove(r: ApiLimeRelease): Promise<void> {
    const ok = await this.feedback.confirm({
      title: `Delete Lime ${r.version}?`,
      message: 'Only possible when no project or environment uses it.',
      confirmLabel: 'Delete release',
      destructive: true,
    });
    if (!ok) return;

    this.api.deleteLimeRelease(r.id).subscribe({
      next: () => {
        this.feedback.success(`Lime ${r.version} deleted.`);
        this.load();
        this.api.reload();
      },
      error: (err) => this.feedback.failed(err, `Lime ${r.version} could not be deleted.`),
    });
  }
}
