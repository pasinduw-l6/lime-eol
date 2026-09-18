import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RegistryStore } from './core/registry.store';

@Component({
  selector: 'lime-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  host: { class: 'block min-h-screen' },
  template: `
    <div class="mx-auto flex min-h-screen max-w-[1500px] flex-col px-5 py-5">
      <header
        class="card mb-5 flex flex-wrap items-center gap-4 px-5 py-3"
        role="banner"
      >
        <a routerLink="/overview" class="flex items-center gap-2.5 no-underline">
          <span
            class="grid h-8 w-8 place-items-center rounded-full"
            style="background: linear-gradient(135deg, var(--color-accent-bright), var(--color-accent-deep))"
            aria-hidden="true"
          ></span>
          <span class="text-[17px] font-semibold text-ink">Lime</span>
        </a>

        <nav class="flex flex-1 flex-wrap justify-center gap-1" aria-label="Sections">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="pill-active"
              class="pill"
            >
              {{ item.label }}
              @if (item.badge && needsYou() > 0) {
                <span class="tabular text-[12px] text-overdue">{{ needsYou() }}</span>
              }
            </a>
          }
        </nav>

        <div class="flex items-center gap-2">
          <span
            class="hidden text-[13px] text-ink-faint sm:inline"
            title="All screens run on data seeded from the registry"
            >mock data</span
          >
          <span
            class="grid h-9 w-9 place-items-center rounded-full bg-elevated text-[13px] font-medium text-ink-soft"
            aria-label="Signed in as Platform Admin"
            >PA</span
          >
        </div>
      </header>

      <main class="flex-1">
        <router-outlet />
      </main>
    </div>
  `,
})
export class App {
  private readonly store = inject(RegistryStore);

  protected readonly nav = [
    { path: '/overview', label: 'Overview', badge: false },
    { path: '/schedule', label: 'Schedule', badge: true },
    { path: '/environments', label: 'Environments', badge: false },
    { path: '/calendar', label: 'Calendar', badge: false },
  ];

  protected readonly needsYou = () => this.store.inbox().length;
}
