import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ActingUser } from './core/acting-user';
import { RegistryStore } from './core/registry.store';

/**
 * Application shell.
 *
 * The project switcher is the most-used control here: engineers work inside
 * one customer installation at a time, and picking one scopes every screen.
 */
@Component({
  selector: 'lime-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  host: { class: 'block min-h-screen' },
  template: `
    <div class="mx-auto flex min-h-screen max-w-[1500px] flex-col px-5 py-5">
      <header class="card mb-5 flex flex-wrap items-center gap-4 px-5 py-3" role="banner">
        <a routerLink="/overview" class="flex items-center gap-2.5 no-underline">
          <span
            class="grid h-8 w-8 place-items-center rounded-full"
            style="background: linear-gradient(135deg, var(--color-accent-bright), var(--color-accent-deep))"
            aria-hidden="true"
          ></span>
          <span class="text-[17px] font-semibold text-ink">Lime</span>
        </a>

        <!-- project switcher -->
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-2 rounded-full border border-rule bg-elevated px-3.5 py-2 text-[13px]"
            [attr.aria-expanded]="open()"
            aria-haspopup="listbox"
            (click)="toggle()"
          >
            <span class="tabular text-ink-faint">{{ activeCode() }}</span>
            <span class="max-w-[190px] truncate text-ink">{{ activeLabel() }}</span>
            <span class="text-ink-soft" aria-hidden="true">▾</span>
          </button>

          @if (open()) {
            <div
              class="card absolute top-[46px] left-0 z-20 w-[320px] p-3 shadow-2xl"
              role="listbox"
              (keydown.escape)="open.set(false)"
            >
              <input
                type="search"
                [(ngModel)]="filter"
                placeholder="Find a project"
                aria-label="Find a project"
                class="mb-2 w-full rounded-lg border border-rule bg-elevated px-3 py-2 text-[13px] text-ink"
              />
              <div class="max-h-[320px] overflow-y-auto">
                <button
                  type="button"
                  role="option"
                  [attr.aria-selected]="scope() === 'all'"
                  class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] hover:bg-elevated"
                  [class.bg-elevated]="scope() === 'all'"
                  (click)="choose('all')"
                >
                  <span>All projects</span>
                  <span class="tabular text-[12px] text-ink-soft">{{ projects().length }}</span>
                </button>

                @for (p of matches(); track p.id) {
                  <button
                    type="button"
                    role="option"
                    [attr.aria-selected]="scope() === p.id"
                    class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-elevated"
                    [class.bg-elevated]="scope() === p.id"
                    (click)="choose(p.id)"
                  >
                    <span class="min-w-0">
                      <span class="block truncate">{{ p.name }}</span>
                      <span class="tabular block text-[11px] text-ink-soft">
                        {{ p.code }} · Lime {{ p.limeVersion }}
                      </span>
                    </span>
                    @if (riskOf(p.id); as risk) {
                      @if (risk.eol > 0) {
                        <span class="tabular shrink-0 text-[12px] text-overdue">{{ risk.eol }}</span>
                      } @else if (risk.near > 0) {
                        <span class="tabular shrink-0 text-[12px] text-soon">{{ risk.near }}</span>
                      }
                    }
                  </button>
                } @empty {
                  <p class="px-3 py-3 text-[13px] text-ink-soft">No project matches.</p>
                }
              </div>
            </div>
          }
        </div>

        <nav class="flex flex-1 flex-wrap justify-center gap-1" aria-label="Sections">
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="pill-active" class="pill">
              {{ item.label }}
              @if (item.badge && needsYou() > 0) {
                <span class="tabular text-[12px] text-overdue">{{ needsYou() }}</span>
              }
            </a>
          }
        </nav>

        <!-- who is acting: every recorded change is attributed to this person -->
        <label class="flex items-center gap-2">
          <span class="sr-only">Acting as</span>
          <select
            class="rounded-full border border-rule bg-elevated px-3 py-1.5 text-[13px] text-ink"
            [value]="acting.current()?.id ?? ''"
            (change)="chooseActor($event)"
            title="Changes you record are attributed to this person"
          >
            @for (person of acting.people(); track person.id) {
              <option [value]="person.id">{{ person.name }}</option>
            }
          </select>
        </label>
      </header>

      <main class="flex-1" (click)="open.set(false)">
        <router-outlet />
      </main>
    </div>
  `,
})
export class App {
  private readonly store = inject(RegistryStore);
  protected readonly acting = inject(ActingUser);

  protected chooseActor(event: Event): void {
    this.acting.choose((event.target as HTMLSelectElement).value);
  }

  protected readonly nav = [
    { path: '/overview', label: 'Overview', badge: false },
    { path: '/projects', label: 'Projects', badge: false },
    { path: '/lifecycle', label: 'Lifecycle', badge: true },
    { path: '/plan', label: 'Plan', badge: false },
    { path: '/calendar', label: 'Calendar', badge: false },
  ];

  protected readonly projects = this.store.projects;
  protected readonly scope = this.store.scope;
  protected readonly open = signal(false);
  protected readonly filter = signal('');

  protected readonly matches = computed(() => {
    const needle = this.filter().trim().toLowerCase();
    return this.store
      .projects()
      .filter(
        (p) =>
          !needle ||
          p.name.toLowerCase().includes(needle) ||
          p.code.toLowerCase().includes(needle) ||
          p.customer.toLowerCase().includes(needle),
      );
  });

  protected readonly activeLabel = computed(
    () => this.store.activeProject()?.name ?? 'All projects',
  );

  protected readonly activeCode = computed(
    () => this.store.activeProject()?.code ?? 'ALL',
  );

  protected readonly needsYou = () => this.store.inbox().length;

  protected riskOf(id: string) {
    return this.store.riskOf(id);
  }

  protected toggle(): void {
    this.open.update((v) => !v);
    this.filter.set('');
  }

  protected choose(scope: string): void {
    this.store.scope.set(scope);
    this.open.set(false);
  }
}
