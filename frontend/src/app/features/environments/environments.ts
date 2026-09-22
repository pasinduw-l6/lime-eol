import { Component, computed, inject, signal } from '@angular/core';
import { Api, ApiComponent, ApiEnvironment, ApiProject } from '../../core/api';
import { RegistryStore } from '../../core/registry.store';
import { formatDate, formatDays, statusFill, statusLabel } from '../../core/lifecycle';
import { TechIcon } from '../../shared/tech-icon';
import { UpdateComponent } from './update-component';

/**
 * Environments.
 *
 * One card per technology rather than per server: engineers think in "what
 * version of MongoDB is this customer on", and the answer should be readable
 * without opening anything. The card's top edge carries its support status,
 * so a wall of cards reads as a risk summary at a glance.
 */
@Component({
  selector: 'lime-environments',
  imports: [TechIcon, UpdateComponent],
  host: { class: 'block' },
  template: `
    @if (api.isLoading()) {
      <p class="card px-7 py-10 text-center text-[14px] text-ink-soft">
        Loading environments…
      </p>
    } @else if (api.error()) {
      <p class="card px-7 py-10 text-center text-[14px] text-overdue" role="alert">
        Could not load projects from the API.
      </p>
    } @else {
      @for (project of projects(); track project.id) {
        <section class="card mb-5 px-7 py-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 class="m-0 text-[30px] font-semibold tracking-[-0.02em]">
                {{ project.name }}
              </h1>
              <p class="m-0 text-[14px] text-ink-soft">
                {{ project.environments.length }} environments ·
                {{ project.engineers.length }} engineers ·
                since {{ project.startedAt }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span class="flex -space-x-1.5">
                @for (e of project.engineers; track e.id) {
                  <span
                    class="grid h-8 w-8 place-items-center rounded-full border border-surface bg-accent-deep text-[11px]"
                    [attr.title]="e.name + (e.isLead ? ' · lead' : '')"
                    >{{ e.initials }}</span
                  >
                }
              </span>
              @if (project.risk.eol > 0) {
                <span class="tabular rounded-full border border-overdue px-3 py-1 text-[13px] text-overdue">
                  {{ project.risk.eol }} past EOL
                </span>
              }
            </div>
          </div>

          <!-- environment tabs -->
          <div class="mt-5 flex flex-wrap gap-1.5" role="tablist">
            @for (env of project.environments; track env.id) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="selectedId() === env.id"
                class="flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px]"
                [class.border-ink]="selectedId() === env.id"
                [class.bg-ink]="selectedId() === env.id"
                [class.text-ground]="selectedId() === env.id"
                [class.border-rule]="selectedId() !== env.id"
                [class.text-ink-soft]="selectedId() !== env.id"
                (click)="selectedId.set(env.id)"
              >
                {{ env.environment }}
                <span class="tabular text-[11px]" [class.text-overdue]="riskOf(env) > 0">
                  {{ riskOf(env) ? riskOf(env) + ' at risk' : 'clear' }}
                </span>
              </button>
            }
          </div>
        </section>

        @if (selected(project); as env) {
          <section class="card px-7 py-6">
            <header class="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <h2 class="m-0 text-[17px] font-semibold">
                {{ project.name }} · {{ env.environment }}
              </h2>
              <p class="m-0 text-[13px] text-ink-soft">
                {{ env.location === 'EC2' ? 'AWS' : 'Customer site' }} ·
                {{ env.locationDetail }} · owned by {{ env.owners.join(', ') || 'nobody' }}
              </p>
            </header>

            <!-- one card per technology -->
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              @for (component of env.components; track component.technology) {
                <button
                  type="button"
                  class="overflow-hidden rounded-[14px] border border-rule bg-elevated text-left transition-colors hover:border-accent"
                  (click)="edit(env, component)"
                  [attr.aria-label]="'Update ' + component.technology + ' on ' + env.environment"
                >
                  <span
                    class="block h-[3px] w-full"
                    [style.background]="fill(component.status)"
                    aria-hidden="true"
                  ></span>

                  <div class="flex items-start gap-3 px-4 pt-4">
                    <lime-tech-icon [technology]="component.technology" [size]="28" />
                    <div class="min-w-0 flex-1">
                      <h3 class="m-0 truncate text-[15px] font-semibold">
                        {{ component.technology }}
                      </h3>
                      <p class="m-0 text-[12px] text-ink-soft">
                        {{ component.componentType.toLowerCase() }} · cycle
                        <span class="tabular">{{ component.cycle }}</span>
                      </p>
                    </div>
                  </div>

                  <div class="flex items-baseline justify-between gap-2 px-4 pt-3">
                    <span class="tabular text-[22px] font-semibold">
                      {{ component.version }}
                    </span>
                    <span class="tabular text-[14px]" [style.color]="fill(component.status)">
                      {{ days(component.daysToEol) }}
                    </span>
                  </div>

                  <dl class="m-0 grid gap-1 px-4 pt-3 pb-4 text-[12px]">
                    <div class="flex justify-between gap-2">
                      <dt class="text-ink-soft">{{ label(component.status) }}</dt>
                      <dd class="tabular m-0">{{ date(component.eolDate) }}</dd>
                    </div>
                    @if (component.latestPatch) {
                      <div class="flex justify-between gap-2">
                        <dt class="text-ink-soft">Latest in cycle</dt>
                        <dd class="tabular m-0" [class.text-soon]="component.latestPatch !== component.version">
                          {{ component.latestPatch }}
                        </dd>
                      </div>
                    }
                    @if (component.eolSource === 'MANUAL') {
                      <div class="flex justify-between gap-2">
                        <dt class="text-ink-soft">Source</dt>
                        <dd class="m-0 text-ink-faint">entered by hand</dd>
                      </div>
                    }
                    <div class="flex justify-between gap-2 pt-1">
                      <dt class="text-ink-soft">Recorded changes</dt>
                      <dd class="tabular m-0 text-accent-bright">update →</dd>
                    </div>
                  </dl>
                </button>
              }
            </div>
          </section>
        }
      } @empty {
        <p class="card px-7 py-10 text-center text-[14px] text-ink-soft">
          No projects yet.
        </p>
      }

      @if (editing(); as target) {
        <lime-update-component
          [environment]="target.environment"
          [component]="target.component"
          (close)="editing.set(null)"
          (saved)="api.reload()"
        />
      }
    }
  `,
})
export class Environments {
  protected readonly api = inject(Api);
  private readonly store = inject(RegistryStore);

  /** Respects the project switcher: one project, or all of them. */
  protected readonly projects = computed(() => {
    const scope = this.store.scope();
    const all = this.api.projects();
    return scope === 'all' ? all : all.filter((p) => p.id === scope);
  });
  protected readonly selectedId = signal<string | null>(null);
  protected readonly editing = signal<{
    environment: ApiEnvironment;
    component: ApiComponent;
  } | null>(null);

  protected edit(environment: ApiEnvironment, component: ApiComponent): void {
    this.editing.set({ environment, component });
  }

  protected selected(project: ApiProject): ApiEnvironment | null {
    const chosen = project.environments.find((e) => e.id === this.selectedId());
    // Default to production: the environment that matters most.
    return (
      chosen ??
      project.environments.find((e) => e.environment === 'PROD') ??
      project.environments[0] ??
      null
    );
  }

  protected riskOf(env: ApiEnvironment): number {
    return env.components.filter(
      (c: ApiComponent) => c.status === 'EOL' || c.status === 'NEAR',
    ).length;
  }

  protected fill = statusFill;
  protected days = formatDays;
  protected date = formatDate;
  protected label = statusLabel;
}
