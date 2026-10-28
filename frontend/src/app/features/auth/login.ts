import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { RoleName } from '../../core/permissions';
import { Session, SessionStore } from '../../core/session';
import { AuthLayout } from './auth-layout';

const SSO_LOGIN_PATH = '/api/v1/auth/oidc/login';

interface PreviewAccount {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  roleName?: string;
}

@Component({
  selector: 'lime-login',
  imports: [HlmButton, AuthLayout],
  host: { class: 'block' },
  template: `
    <lime-auth-layout
      heading="Sign in"
      subheading="Changes you record are attributed to your account."
    >
      <div class="grid gap-4">
        @if (shownError()) {
          <p class="m-0 text-[13px] text-red-400" role="alert">
            {{ shownError() }}
          </p>
        }

        <button
          type="button"
          hlmBtn
          size="lg"
          class="w-full gap-2.5"
          (click)="startSso()"
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
            class="shrink-0"
          >
            <path fill="#f25022" d="M0 0h7.2v7.2H0z" />
            <path fill="#7fba00" d="M8.8 0H16v7.2H8.8z" />
            <path fill="#00a4ef" d="M0 8.8h7.2V16H0z" />
            <path fill="#ffb900" d="M8.8 8.8H16V16H8.8z" />
          </svg>
          Sign in with Microsoft
        </button>

        <p class="m-0 text-center text-[13px] text-zinc-400">
          Use your {{ '@' }}linearsix.com account. Access is granted by an
          administrator — there is no self-service registration.
        </p>

        @if (preview().length > 0) {
          <section class="mt-2 rounded-lg border border-dashed border-white/20 p-3" aria-labelledby="preview-title">
            <p id="preview-title" class="m-0 mb-2 text-xs font-medium tracking-wider text-zinc-400 uppercase">
              Local preview · sign in as
            </p>
            <ul class="m-0 grid max-h-64 list-none gap-1 overflow-y-auto p-0">
              @for (a of preview(); track a.id) {
                <li>
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10"
                    [disabled]="busy()"
                    (click)="signInAs(a)"
                  >
                    <span class="min-w-0">
                      <span class="block truncate font-medium">{{ a.name }}</span>
                      <span class="block truncate text-xs text-zinc-400">{{ a.email }}</span>
                    </span>
                    <span class="shrink-0 rounded-md border border-white/20 px-1.5 text-xs text-zinc-300">{{ a.roleName ?? a.role }}</span>
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    </lime-auth-layout>
  `,
})
export class Login {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  readonly next = input<string>('');

  readonly failure = input<string>('', { alias: 'error' });

  protected readonly preview = signal<PreviewAccount[]>([]);
  protected readonly busy = signal(false);
  private readonly previewError = signal<string | null>(null);

  protected readonly shownError = computed(
    () => this.previewError() ?? failureMessage(this.failure()),
  );

  constructor() {
    this.http
      .get<{ enabled: boolean; users: PreviewAccount[] }>('/api/v1/auth/preview')
      .subscribe({ next: (res) => this.preview.set(res.enabled ? res.users : []) });
  }

  protected startSso(): void {
    const next = this.next();
    window.location.href = next
      ? `${SSO_LOGIN_PATH}?next=${encodeURIComponent(next)}`
      : SSO_LOGIN_PATH;
  }

  protected signInAs(account: PreviewAccount): void {
    this.busy.set(true);
    this.http.post<Session>(`/api/v1/auth/preview/${account.id}`, {}).subscribe({
      next: (session) => {
        this.session.adopt(session);
        void this.router.navigateByUrl(this.next() || '/overview');
      },
      error: () => {
        this.busy.set(false);
        this.previewError.set('That preview sign-in did not work.');
      },
    });
  }
}

function failureMessage(reason: string): string | null {
  if (!reason) {
    return null;
  }

  return reason === 'sso_failed'
    ? 'That sign-in could not be completed. Please try again.'
    : reason;
}
