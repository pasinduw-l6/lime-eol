import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '../../core/session';
import { AuthLayout } from './auth-layout';

/**
 * Sign in.
 *
 * The form and its validation only; there is no auth API yet, so submitting a
 * valid form goes straight to the overview. Everything the server will need is
 * already gathered here, so wiring it up later is one call in `submit`.
 */
@Component({
  selector: 'lime-login',
  imports: [FormsModule, RouterLink, AuthLayout],
  host: { class: 'block' },
  template: `
    <lime-auth-layout
      heading="Sign in"
      subheading="Changes you record are attributed to your account."
    >
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
            <span class="mt-1 block text-[12px] text-overdue">{{ emailError() }}</span>
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
            <span class="mt-1 block text-[12px] text-overdue">Enter your password.</span>
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

        @if (error()) {
          <p class="m-0 text-[13px] text-overdue" role="alert">{{ error() }}</p>
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
    </lime-auth-layout>
  `,
})
export class Login {
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  /** Where to go after signing in, set by the guard that sent them here. */
  readonly next = input<string>('');

  protected readonly busy = signal(false);
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly remember = signal(true);
  protected readonly reveal = signal(false);
  protected readonly touched = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly emailError = computed(() => {
    const value = this.email().trim();
    if (!value) {
      return 'Enter your work email.';
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? null
      : 'That does not look like an email address.';
  });

  // Errors appear once the field has been left or the form pushed, never while
  // the first character is still being typed.
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
