import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Api } from '../../core/api';
import { SessionStore } from '../../core/session';
import { Theme } from '../../core/theme';
import { FormalReport } from './formal-report';

declare global {
  interface Window {
    limeReportReady?: boolean;
  }
}

@Component({
  selector: 'lime-report',
  imports: [FormalReport],
  host: { class: 'block bg-background' },
  template: `
    <div>
      @if (kind === 'all') {
        <lime-formal-report />
      } @else {
        @if (projectCustomer(); as customerId) {
          <lime-formal-report [customerId]="customerId" [projectId]="id" />
        }
      }
    </div>
  `,
})
export class Report {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionStore);
  private readonly theme = inject(Theme);
  private readonly adopted = this.adoptToken();
  private readonly api = inject(Api);

  protected readonly kind = this.route.snapshot.paramMap.get('kind') === 'all' ? 'all' : 'project';
  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly projectCustomer = computed(() => this.api.projects().find((p) => p.id === this.id)?.customerId ?? null);

  constructor() {
    effect(() => {
      const loaded =
        !this.api.isLoading() &&
        (this.api.projects().length > 0 || !!this.api.error()) &&
        this.api.customers().length > 0 &&
        !this.api.actionsResource.isLoading() &&
        this.api.technologies().length > 0;
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


}
