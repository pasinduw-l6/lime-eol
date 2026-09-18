import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RegistryStore } from './core/registry.store';

@Component({
  selector: 'lime-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  host: { class: 'block h-full' },
  template: `
    <div class="flex h-full min-h-screen">
      <nav
        class="flex w-[184px] shrink-0 flex-col border-r border-rule bg-surface"
        aria-label="Sections"
      >
        <a routerLink="/schedule" class="block px-5 pt-5 pb-6 no-underline">
          <span class="block text-[15px] font-semibold text-ink">Lime</span>
          <span class="block text-[15px] text-ink-soft">Lifecycle</span>
        </a>

        <ul class="m-0 flex list-none flex-col gap-px p-0">
          @for (item of nav; track item.path) {
            <li>
              <a
                [routerLink]="item.path"
                routerLinkActive="bg-ground font-medium text-ink"
                class="flex items-center justify-between px-5 py-2 text-[14px] text-ink-soft no-underline hover:bg-ground"
              >
                <span>{{ item.label }}</span>
                @if (item.path === '/schedule' && needsYou() > 0) {
                  <span
                    class="tabular text-[12px] text-overdue"
                    [attr.aria-label]="needsYou() + ' items need attention'"
                    >{{ needsYou() }}</span
                  >
                }
              </a>
            </li>
          }
        </ul>

        <div class="mt-auto px-5 py-4 text-[12px] text-ink-soft">
          <span class="block">Mock data</span>
          <span class="block">seeded registry</span>
        </div>
      </nav>

      <main class="min-w-0 flex-1 overflow-x-hidden">
        <router-outlet />
      </main>
    </div>
  `,
})
export class App {
  private readonly store = inject(RegistryStore);

  protected readonly nav = [
    { path: '/schedule', label: 'Schedule' },
    { path: '/environments', label: 'Environments' },
    { path: '/calendar', label: 'Calendar' },
  ];

  protected readonly needsYou = () => this.store.inbox().length;
}
