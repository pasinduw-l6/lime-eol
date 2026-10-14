import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { Api, ApiRole } from '../../core/api';
import { Feedback } from '../../core/feedback';
import { PAGE_INFO, PERMISSION_INFO, pageLabel, permissionLabel } from '../../core/permissions';
import { Modal } from '../../shared/modal';

interface RoleDraft {
  key?: string;
  builtIn: boolean;
  name: string;
  description: string;
  permissions: string[];
  pages: string[];
}

@Component({
  selector: 'lime-roles-editor',
  imports: [FormsModule, HlmBadgeImports, HlmButton, HlmCardImports, HlmInput, HlmLabel, Modal],
  host: { class: 'block' },
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <p class="m-0 mr-auto text-sm text-muted-foreground">
        A role decides which pages a person sees and what kind of change they can make. Project access decides on which projects.
      </p>
      <button type="button" hlmBtn (click)="create()">New role</button>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      @for (r of roles(); track r.key) {
        <article hlmCard class="gap-4 py-5">
          <div class="flex items-start justify-between gap-3 px-5">
            <div class="min-w-0">
              <h3 class="m-0 flex items-center gap-2 text-base font-semibold">
                {{ r.name }}
                @if (r.builtIn) {
                  <span hlmBadge variant="outline" class="font-normal">Built in</span>
                }
              </h3>
              <p class="m-0 mt-0.5 text-xs text-muted-foreground">
                {{ r.users }} {{ r.users === 1 ? 'person' : 'people' }}{{ r.description ? ' · ' + r.description : '' }}
              </p>
            </div>
            <span class="flex shrink-0 gap-1">
              @if (r.editable) {
                <button type="button" hlmBtn variant="ghost" size="sm" (click)="edit(r)">Edit</button>
              }
              @if (!r.builtIn) {
                <button type="button" hlmBtn variant="ghost" size="sm" class="text-destructive" (click)="askDelete(r)">Delete</button>
              }
            </span>
          </div>
          <div class="px-5">
            <p class="m-0 mb-1.5 text-xs text-muted-foreground">Sees</p>
            <div class="flex flex-wrap gap-1">
              @for (p of r.pages; track p) {
                <span hlmBadge variant="secondary">{{ pageName(p) }}</span>
              }
            </div>
          </div>
          <div class="border-t px-5 pt-4">
            <p class="m-0 mb-1.5 text-xs text-muted-foreground">Can change</p>
            <div class="flex flex-wrap gap-1">
              @if (r.key === 'ADMIN') {
                <span hlmBadge variant="outline">Everything, plus people, roles and access</span>
              } @else {
                @for (p of r.permissions; track p) {
                  <span hlmBadge variant="outline">{{ permissionName(p) }}</span>
                } @empty {
                  <span class="text-sm text-muted-foreground">Nothing · read only</span>
                }
              }
            </div>
          </div>
        </article>
      }
    </div>

    @if (draft(); as d) {
      <lime-modal [title]="d.key ? 'Edit ' + d.name : 'New role'" (dismiss)="draft.set(null)">
        <form class="grid gap-5" (submit)="save($event)">
          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Name
              <input hlmInput name="name" [(ngModel)]="d.name" placeholder="Account manager" maxlength="60" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Description
              <input hlmInput name="description" [(ngModel)]="d.description" placeholder="What this role is for" maxlength="300" />
            </label>
          </div>

          <fieldset class="m-0 border-0 p-0">
            <legend class="mb-2 p-0 text-sm font-medium">Pages they see</legend>
            <div class="grid gap-2 sm:grid-cols-2">
              @for (p of pages; track p.key) {
                <label class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm" [class.opacity-60]="p.locked">
                  <input type="checkbox" [checked]="p.locked || d.pages.includes(p.key)" [disabled]="p.locked" (change)="toggle(d.pages, p.key)" />
                  {{ p.label }}
                  @if (p.locked) {
                    <span class="ml-auto text-xs text-muted-foreground">Always</span>
                  }
                </label>
              }
            </div>
          </fieldset>

          <fieldset class="m-0 border-0 p-0">
            <legend class="mb-1 p-0 text-sm font-medium">What they can change</legend>
            <p class="m-0 mb-2 text-xs text-muted-foreground">Only on projects where they have Edit under Project access. Leave all unticked for a read-only role.</p>
            <div class="grid gap-2">
              @for (p of permissions; track p.key) {
                <label class="flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm">
                  <input type="checkbox" class="mt-0.5" [checked]="d.permissions.includes(p.key)" (change)="toggle(d.permissions, p.key)" />
                  <span>
                    <span class="block">{{ p.label }}</span>
                    <span class="block text-xs text-muted-foreground">{{ p.description }}</span>
                  </span>
                </label>
              }
            </div>
          </fieldset>

          @if (d.key && users(d.key) > 0) {
            <p class="m-0 text-xs text-muted-foreground">
              Changes apply to {{ users(d.key) }} {{ users(d.key) === 1 ? 'person' : 'people' }} on their next page load.
            </p>
          }

          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="draft.set(null)">Cancel</button>
            <button type="submit" hlmBtn [disabled]="busy()">{{ d.key ? 'Save changes' : 'Create role' }}</button>
          </div>
        </form>
      </lime-modal>
    }

    @if (deleting(); as r) {
      <lime-modal [title]="'Delete ' + r.name + '?'" (dismiss)="deleting.set(null)">
        <form class="grid gap-4" (submit)="remove($event, r)">
          @if (r.users > 0) {
            <p class="m-0 text-sm">
              {{ r.users }} {{ r.users === 1 ? 'person has' : 'people have' }} this role. Choose the role they get instead.
            </p>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Move them to
              <select hlmInput name="moveTo" [(ngModel)]="moveTo">
                @for (o of others(); track o.key) {
                  <option [value]="o.key">{{ o.name }}</option>
                }
              </select>
            </label>
          } @else {
            <p class="m-0 text-sm">Nobody has this role. It is removed straight away.</p>
          }
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="deleting.set(null)">Cancel</button>
            <button type="submit" hlmBtn variant="destructive" [disabled]="busy()">Delete role</button>
          </div>
        </form>
      </lime-modal>
    }
  `,
})
export class RolesEditor {
  private readonly api = inject(Api);
  private readonly feedback = inject(Feedback);

  readonly roles = input.required<ApiRole[]>();
  readonly changed = output<void>();

  protected readonly pages = PAGE_INFO;
  protected readonly permissions = PERMISSION_INFO;
  protected readonly pageName = pageLabel;
  protected readonly permissionName = permissionLabel;

  protected readonly draft = signal<RoleDraft | null>(null);
  protected readonly deleting = signal<ApiRole | null>(null);
  protected readonly busy = signal(false);
  protected moveTo = 'VIEWER';

  protected readonly others = computed(() => this.roles().filter((r) => r.key !== this.deleting()?.key));

  protected users(key: string): number {
    return this.roles().find((r) => r.key === key)?.users ?? 0;
  }

  protected create(): void {
    this.draft.set({ builtIn: false, name: '', description: '', permissions: [], pages: ['overview'] });
  }

  protected edit(role: ApiRole): void {
    this.draft.set({
      key: role.key,
      builtIn: role.builtIn,
      name: role.name,
      description: role.description ?? '',
      permissions: [...role.permissions],
      pages: [...role.pages],
    });
  }

  protected toggle(list: string[], key: string): void {
    const at = list.indexOf(key);
    if (at >= 0) list.splice(at, 1);
    else list.push(key);
  }

  protected save(event: Event): void {
    event.preventDefault();
    const d = this.draft();
    if (!d) return;
    if (d.name.trim().length < 2) {
      this.feedback.error('Give the role a name.');
      return;
    }

    const body = {
      name: d.name.trim(),
      description: d.description.trim() || null,
      permissions: d.permissions,
      pages: d.pages,
    };
    this.busy.set(true);
    (d.key ? this.api.updateRole(d.key, body) : this.api.createRole(body)).subscribe({
      next: (role) => {
        this.busy.set(false);
        this.draft.set(null);
        this.feedback.success(`${role.name} saved.`);
        this.changed.emit();
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'Could not save that role.');
      },
    });
  }

  protected askDelete(role: ApiRole): void {
    this.deleting.set(role);
    this.moveTo = this.others().some((r) => r.key === 'VIEWER') ? 'VIEWER' : (this.others()[0]?.key ?? '');
  }

  protected remove(event: Event, role: ApiRole): void {
    event.preventDefault();
    this.busy.set(true);
    this.api.deleteRole(role.key, role.users > 0 ? this.moveTo : undefined).subscribe({
      next: () => {
        this.busy.set(false);
        this.deleting.set(null);
        this.feedback.success(`${role.name} deleted.`);
        this.changed.emit();
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'Could not delete that role.');
      },
    });
  }
}
