import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Api } from '../../core/api';
import { parseDate, today } from '../../core/lifecycle';
import { RegistryStore } from '../../core/registry.store';
import { SessionStore } from '../../core/session';
import { Theme } from '../../core/theme';
import { Overview } from '../overview/overview';

declare global {
  interface Window {
    limeReportReady?: boolean;
  }
}

@Component({
  selector: 'lime-report',
  imports: [Overview],
  host: { class: 'block bg-background' },
  styles: `
    .report-page {
      break-before: page;
    }
  `,
  template: `
    <div class="mx-auto max-w-[1100px] px-2 py-2">
      @if (kind === 'customer') {
        @if (customer(); as c) {
          <section class="report-cover">
            <p class="m-0 text-xs font-medium tracking-widest text-muted-foreground uppercase">Technology lifecycle report</p>
            <h1 class="m-0 mt-3 text-4xl font-semibold tracking-tight">{{ c.name }}</h1>
            <p class="m-0 mt-2 text-base text-muted-foreground">
              {{ projects().length }} {{ projects().length === 1 ? 'project' : 'projects' }} · prepared by Lime on {{ longDate(asOf) }}
            </p>

            <table class="mt-10 w-full border-collapse text-sm">
              <thead>
                <tr class="border-b text-left text-muted-foreground">
                  <th class="py-2 pr-4 font-medium">Project</th>
                  <th class="py-2 pr-4 font-medium">Lime</th>
                  <th class="py-2 pr-4 font-medium">Environments</th>
                  <th class="py-2 pr-4 font-medium">Past end of support</th>
                  <th class="py-2 pr-4 font-medium">Ending within 180 days</th>
                  <th class="py-2 font-medium">Next end of support</th>
                </tr>
              </thead>
              <tbody>
                @for (row of summary(); track row.id) {
                  <tr class="border-b">
                    <td class="py-2.5 pr-4 font-medium">{{ row.name }}</td>
                    <td class="tabular py-2.5 pr-4">{{ row.lime }}</td>
                    <td class="tabular py-2.5 pr-4">{{ row.environments }}</td>
                    <td class="tabular py-2.5 pr-4" [style.color]="row.eol ? 'var(--destructive)' : ''">{{ row.eol }}</td>
                    <td class="tabular py-2.5 pr-4" [style.color]="row.near ? 'var(--warning)' : ''">{{ row.near }}</td>
                    <td class="tabular py-2.5">{{ row.next }}</td>
                  </tr>
                }
              </tbody>
            </table>

            @if (c.commercialModel || c.contractEnd) {
              <p class="m-0 mt-6 text-sm text-muted-foreground">
                {{ c.commercialModel === 'SUBSCRIPTION' ? 'Subscription' : c.commercialModel === 'LICENSE' ? 'License' : '' }}
                @if (c.contractEnd) {
                  · agreement until {{ longDate(parse(c.contractEnd)) }}
                }
              </p>
            }
          </section>

          @for (p of projects(); track p.id) {
            <div class="report-page">
              <lime-overview [projectId]="p.id" />
            </div>
          }
        }
      } @else {
        <lime-overview [projectId]="id" />
      }
    </div>
  `,
})
export class Report {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionStore);
  private readonly theme = inject(Theme);
  private readonly adopted = this.adoptToken();
  private readonly store = inject(RegistryStore);
  private readonly api = inject(Api);

  protected readonly kind = this.route.snapshot.paramMap.get('kind') === 'customer' ? 'customer' : 'project';
  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly asOf = today();

  protected readonly customer = computed(() => this.api.customers().find((c) => c.id === this.id) ?? null);

  protected readonly projects = computed(() =>
    this.api
      .projects()
      .filter((p) => p.customerId === this.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly summary = computed(() =>
    this.projects().map((p) => {
      const risk = this.store.riskOf(p.id);
      const ends = this.store
        .deploymentsOf(p.id)
        .flatMap((d) => d.components)
        .map((c) => this.store.resolve(c.technology, c.version))
        .filter((r) => r.days !== null && r.days > 0 && r.cycle?.eolDate)
        .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
      const next = ends[0];
      return {
        id: p.id,
        name: p.name,
        lime: p.limeVersion ?? '—',
        environments: p.environments.length,
        eol: risk.eol,
        near: risk.near,
        next: next ? `${next.technology} · ${this.longDate(parseDate(next.cycle!.eolDate))}` : '—',
      };
    }),
  );

  constructor() {
    effect(() => {
      const loaded =
        !this.api.isLoading() &&
        (this.api.projects().length > 0 || !!this.api.error()) &&
        (this.kind === 'project' || this.api.customers().length > 0);
      if (loaded && this.adopted) {
        setTimeout(() => (window.limeReportReady = true), 1200);
      }
    });
  }

  private adoptToken(): boolean {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    this.theme.mode.set('light');
    if (!token) return !!this.session.user();

    this.session.adopt({
      token,
      id: 'report',
      email: '',
      displayName: 'Report',
      role: 'VIEWER',
      initials: '',
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    return true;
  }

  protected parse(value: string | null) {
    return parseDate(value);
  }

  protected longDate(value: Date | null): string {
    return value
      ? value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      : '—';
  }
}
