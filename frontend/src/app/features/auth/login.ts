import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '../../core/session';
import { AuthLayout } from './auth-layout';

interface AuthMode {
  mode: 'dev' | 'entra' | 'oidc' | 'saml';
  ssoLoginPath: string | null;
}

@Component({
  selector: 'lime-login',
  imports: [FormsModule, RouterLink, AuthLayout],
  host: { class: 'block' },
  template: `
    <lime-auth-layout
      heading="Sign in"
      subheading="Changes you record are attributed to your account."
    >
      @if (!resolved()) {
        <p class="m-0 text-[14px] text-ink-soft" role="status">One moment…</p>
      } @else if (usesSso()) {
        <div class="grid gap-4">
          @if (shownError()) {
            <p class="m-0 text-[13px] text-overdue" role="alert">
              {{ shownError() }}
            </p>
          }

          <button
            type="button"
            class="btn btn-primary w-full justify-center gap-2.5 py-2.5"
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

          <p class="m-0 text-center text-[13px] text-ink-soft">
            Use your {{ '@' }}linearsix.com account. Access is granted by an
            administrator — there is no self-service registration.
          </p>
        </div>
      } @else {
        <form class="grid gap-4" (submit)="submit($event)" novalidate>
          <label class="field">
            Work email
            <input
              class="input"
              type="email"
              name="email"
              autocomplete="username"
              placeholder="nimal@linearsix.com"
              [(ngModel)]="email"
              (blur)="touched.set(true)"
              [attr.aria-invalid]="showEmailError() || null"
            />
            @if (showEmailError()) {
              <span class="mt-1 block text-[12px] text-overdue">{{
                emailError()
              }}</span>
            }
          </label>

          <label class="field">
            Password
            <span class="relative flex">
              <input
                class="input pr-[4.5rem]"
                [type]="reveal() ? 'text' : 'password'"
                name="password"
                autocomplete="current-password"
                placeholder="••••••••••••"
                [(ngModel)]="password"
                [attr.aria-invalid]="showPasswordError() || null"
              />
              <button
                type="button"
                class="absolute top-1/2 right-3 -translate-y-1/2 text-[12px] text-ink-soft hover:text-ink"
                (click)="reveal.set(!reveal())"
                [attr.aria-pressed]="reveal()"
              >
                {{ reveal() ? 'Hide' : 'Show' }}
              </button>
            </span>
            @if (showPasswordError()) {
              <span class="mt-1 block text-[12px] text-overdue"
                >Enter your password.</span
              >
            }
          </label>

          <div class="flex items-center justify-between gap-3">
            <label class="flex items-center gap-2 text-[13px] text-ink-soft">
              <input type="checkbox" name="remember" [(ngModel)]="remember" />
              Stay signed in
            </label>
            <a class="text-[13px] text-accent-bright no-underline hover:underline" href="#">
              Forgot password?
            </a>
          </div>

          @if (shownError()) {
            <p class="m-0 text-[13px] text-overdue" role="alert">
              {{ shownError() }}
            </p>
          }

          <button
            type="submit"
            class="btn btn-primary w-full justify-center py-2.5"
            [disabled]="busy()"
          >
            {{ busy() ? 'Signing in…' : 'Sign in' }}
          </button>

          <p class="m-0 text-center text-[13px] text-ink-soft">
            No account yet?
            <a routerLink="/signup" class="text-accent-bright no-underline hover:underline">
              Create one
            </a>
          </p>
        </form>
      }
    </lime-auth-layout>
  `,
})
export class Login {
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly http = inject(HttpClient);

  readonly next = input<string>('');

  /**
   * Set by the API when a single sign-on attempt fails: it cannot render an
   * error itself mid-redirect, so it sends people back here with a reason.
   */
  readonly failure = input<string>('', { alias: 'error' });

  protected readonly busy = signal(false);
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly remember = signal(true);
  protected readonly reveal = signal(false);
  protected readonly touched = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);

  /**
   * Which sign-in the API expects. Asked rather than assumed, so the page can
   * never offer a password form to a deployment that only accepts Microsoft
   * sign-in, or the reverse.
   */
  protected readonly authMode = signal<AuthMode | null>(null);
  protected readonly resolved = computed(() => this.authMode() !== null);
  protected readonly usesSso = computed(
    () => this.authMode()?.ssoLoginPath != null,
  );

  protected readonly shownError = computed(
    () => this.error() ?? failureMessage(this.failure()),
  );

  constructor() {
    this.http.get<AuthMode>('/api/v1/auth/mode').subscribe({
      next: (mode) => this.authMode.set(mode),
      // An unreachable API is not a reason to hide the form; falling back to the
      // password path at least lets someone see the real error when they submit.
      error: () => this.authMode.set({ mode: 'dev', ssoLoginPath: null }),
    });
  }

  protected startSso(): void {
    const path = this.authMode()?.ssoLoginPath;
    if (!path) {
      return;
    }

    const next = this.next();
    window.location.href = next
      ? `${path}?next=${encodeURIComponent(next)}`
      : path;
  }

  protected readonly emailError = computed(() => {
    const value = this.email().trim();
    if (!value) {
      return 'Enter your work email.';
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? null
      : 'That does not look like an email address.';
  });

  protected readonly showEmailError = computed(
    () => !!this.emailError() && (this.touched() || this.submitted()),
  );

  protected readonly showPasswordError = computed(
    () => this.submitted() && this.password().length === 0,
  );

  protected submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    this.error.set(null);

    if (this.emailError() || !this.password()) {
      return;
    }

    this.busy.set(true);

    this.session.signIn(this.email().trim(), this.password()).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigateByUrl(this.next() || '/overview');
      },
      error: (err: { status?: number; error?: { message?: string | string[] } }) => {
        this.busy.set(false);
        const message = err.error?.message;

        this.error.set(
          err.status === 0
            ? 'Could not reach the server. Check that the API is running.'
            : Array.isArray(message)
              ? message.join('. ')
              : (message ?? 'That email and password do not match.'),
        );
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
