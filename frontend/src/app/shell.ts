import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RegistryStore } from './core/registry.store';
import { SessionStore } from './core/session';
import { Theme } from './core/theme';
import { Celebrate } from './shared/celebrate';
import { NotificationMenu } from './shared/notification-menu';
import { ShaderBackground } from './shared/shader-background';

@Component({
  selector: 'lime-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, Celebrate, ShaderBackground, NotificationMenu],
  host: { class: 'block min-h-screen' },
  template: `
    @defer (on idle) {
      <lime-shader-background />
    }

    <div class="mx-auto flex min-h-screen max-w-[1500px] flex-col px-5 py-5">
      <header
        class="card app-bar mb-5 flex flex-wrap items-center gap-4 px-5 py-3"
        role="banner"
      >
        <a
          routerLink="/overview"
          class="brand-plate flex items-center no-underline"
          aria-label="Lime Lifecycle — overview"
        >
          <img src="/nav-logo.png" alt="Lime" class="h-6 w-auto" />
        </a>

        <div class="relative">
          <button
            type="button"
            class="glass flex items-center gap-2 rounded-full border border-rule bg-elevated px-3.5 py-2 text-[13px]"
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
              class="card popover absolute top-[46px] left-0 z-20 w-[320px] p-3 shadow-2xl"
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
              <div class="scroll-hidden max-h-[320px] overflow-y-auto">
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

        <lime-notification-menu />

        <button
          type="button"
          class="glass grid h-9 w-9 place-items-center rounded-full border border-rule bg-elevated text-ink-soft hover:text-ink"
          (click)="theme.toggle()"
          [attr.aria-label]="
            theme.mode() === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'
          "
          [title]="theme.mode() === 'dark' ? 'Light theme' : 'Dark theme'"
        >
          @if (theme.mode() === 'dark') {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke-linecap="round" />
            </svg>
          } @else {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke-linejoin="round" />
            </svg>
          }
        </button>

        @if (session.user(); as me) {
          <span
            class="glass flex items-center gap-2.5 rounded-full border border-rule bg-elevated py-1 pr-3 pl-1"
            [title]="me.email + ' · ' + me.role.toLowerCase()"
          >
            <span
              class="grid h-7 w-7 place-items-center rounded-full brand-gradient text-[11px]"
              aria-hidden="true"
              >{{ me.initials }}</span
            >
            <span class="text-[13px]">{{ me.displayName }}</span>
            @if (me.role === 'VIEWER') {
              <span class="text-[11px] text-ink-faint">read only</span>
            }
          </span>
        }

        <button
          type="button"
          class="text-[13px] text-ink-soft hover:text-ink"
          (click)="signOut()"
        >
          Sign out
        </button>
      </header>

      <main class="flex-1" (click)="open.set(false)">
        <router-outlet />
      </main>
    </div>

    <lime-celebrate />
  `,
})
export class Shell {
  private readonly store = inject(RegistryStore);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);
  protected readonly theme = inject(Theme);

  protected signOut(): void {
    this.session.signOut();
    void this.router.navigateByUrl('/login');
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
