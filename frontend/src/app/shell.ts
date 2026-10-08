import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { RegistryStore } from './core/registry.store';
import { SessionStore } from './core/session';
import { Theme } from './core/theme';
import { Celebrate } from './shared/celebrate';
import { NotificationMenu } from './shared/notification-menu';

@Component({
  selector: 'lime-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    HlmAvatarImports,
    HlmButton,
    HlmInput,
    Celebrate,
    NotificationMenu,
  ],
  host: { class: 'block min-h-screen bg-background' },
  template: `
    <header class="app-bar border-b" role="banner">
      <div class="mx-auto flex h-14 max-w-[1500px] items-center gap-3 px-5">
        <a
          routerLink="/overview"
          class="brand-plate shrink-0 no-underline"
          aria-label="Lime Lifecycle — overview"
        >
          <img src="/nav-logo.png" alt="Lime" class="h-6 w-auto" />
        </a>

        <span class="h-5 w-px bg-border" aria-hidden="true"></span>

        <div class="relative">
          <button
            type="button"
            hlmBtn
            variant="outline"
            size="sm"
            class="max-w-[260px] justify-between gap-2"
            [attr.aria-expanded]="open()"
            aria-haspopup="listbox"
            (click)="toggle()"
          >
            <span class="tabular text-xs text-muted-foreground">{{ activeCode() }}</span>
            <span class="truncate">{{ activeLabel() }}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-50" aria-hidden="true">
              <path d="m7 15 5 5 5-5M7 9l5-5 5 5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          @if (open()) {
            <div class="fixed inset-0 z-30" (click)="open.set(false)" aria-hidden="true"></div>
            <div
              class="popover absolute top-10 left-0 z-40 w-[320px] p-1"
              role="listbox"
              (keydown.escape)="open.set(false)"
            >
              <div class="border-b p-1 pb-2">
                <input
                  hlmInput
                  type="search"
                  [(ngModel)]="filter"
                  placeholder="Find a project…"
                  aria-label="Find a project"
                  class="h-8"
                />
              </div>
              <div class="scroll-hidden max-h-[320px] overflow-y-auto p-1">
                @for (p of matches(); track p.id) {
                  <button
                    type="button"
                    role="option"
                    [attr.aria-selected]="scope() === p.id"
                    class="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    [class.bg-accent]="scope() === p.id"
                    (click)="choose(p.id)"
                  >
                    <span class="min-w-0">
                      <span class="block truncate">{{ p.name }}</span>
                      <span class="tabular block text-xs text-muted-foreground">
                        {{ p.code }} · Lime {{ p.limeVersion }}
                      </span>
                    </span>
                    @if (riskOf(p.id); as risk) {
                      @if (risk.eol > 0) {
                        <span class="tabular shrink-0 rounded-md bg-destructive/10 px-1.5 text-xs text-destructive">{{ risk.eol }}</span>
                      } @else if (risk.near > 0) {
                        <span class="tabular shrink-0 rounded-md bg-warning/15 px-1.5 text-xs text-warning">{{ risk.near }}</span>
                      }
                    }
                  </button>
                } @empty {
                  <p class="px-2 py-6 text-center text-sm text-muted-foreground">No project matches.</p>
                }
              </div>
            </div>
          }
        </div>

        <nav class="flex flex-1 items-center gap-1 overflow-x-auto" aria-label="Sections">
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="pill-active" class="pill">
              {{ item.label }}
              @if (item.badge && needsYou() > 0) {
                <span class="tabular rounded-md bg-destructive/10 px-1.5 text-xs text-destructive">{{ needsYou() }}</span>
              }
            </a>
          }
        </nav>

        <lime-notification-menu />

        <button
          type="button"
          hlmBtn
          variant="ghost"
          size="icon"
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
          <span class="flex items-center gap-2" [title]="me.email + ' · ' + me.role.toLowerCase()">
            <hlm-avatar size="sm">
              <span hlmAvatarFallback class="bg-primary text-[10px] font-semibold text-primary-foreground">{{ me.initials }}</span>
            </hlm-avatar>
            <span class="hidden text-sm font-medium xl:inline">{{ me.displayName }}</span>
            @if (me.role === 'VIEWER') {
              <span class="rounded-md border px-1.5 text-xs text-muted-foreground">read only</span>
            }
          </span>
        }

        <button type="button" hlmBtn variant="ghost" size="sm" (click)="signOut()">Sign out</button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-[1500px] flex-1 px-5 py-6">
      <router-outlet />
    </main>

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
    () => this.store.activeProject()?.name ?? 'No project',
  );

  protected readonly activeCode = computed(
    () => this.store.activeProject()?.code ?? '—',
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
