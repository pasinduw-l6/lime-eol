import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthLayout } from './auth-layout';

/** Length is what makes a passphrase hard, so that is what the meter measures. */
const MIN_LENGTH = 12;

@Component({
  selector: 'lime-sign-up',
  imports: [FormsModule, RouterLink, AuthLayout],
  host: { class: 'block' },
  template: `
    <lime-auth-layout
      heading="Create your account"
      subheading="Use your work email. Your name appears on every change you record."
    >
      <form class="grid gap-4" (submit)="submit($event)" novalidate>
        <label class="field">
          Full name
          <input
            class="input"
            name="name"
            autocomplete="name"
            placeholder="Nimal Perera"
            [(ngModel)]="displayName"
            [attr.aria-invalid]="showError('name') || null"
          />
          @if (showError('name')) {
            <span class="mt-1 block text-[12px] text-overdue">
              Enter the name colleagues will see on your changes.
            </span>
          }
        </label>

        <label class="field">
          Work email
          <input
            class="input"
            type="email"
            name="email"
            autocomplete="username"
            placeholder="nimal@linearsix.com"
            [(ngModel)]="email"
            [attr.aria-invalid]="showError('email') || null"
          />
          @if (showError('email')) {
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
              autocomplete="new-password"
              placeholder="at least {{ minLength }} characters"
              [(ngModel)]="password"
              [attr.aria-invalid]="showError('password') || null"
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

          <!-- Four segments rather than a word: it shows progress while typing
               without pretending to score the password precisely. -->
          <span class="mt-2 flex gap-1.5" aria-hidden="true">
            @for (segment of [0, 1, 2, 3]; track segment) {
              <span
                class="h-1 flex-1 rounded-full transition-colors"
                [style.background]="segment < strength() ? strengthColour() : 'var(--color-rule)'"
              ></span>
            }
          </span>
          <span class="mt-1 block text-[12px]" [style.color]="strengthColour()">
            {{ strengthLabel() }}
          </span>
        </label>

        <label class="field">
          Confirm password
          <input
            class="input"
            [type]="reveal() ? 'text' : 'password'"
            name="confirm"
            autocomplete="new-password"
            [(ngModel)]="confirm"
            [attr.aria-invalid]="showError('confirm') || null"
          />
          @if (showError('confirm')) {
            <span class="mt-1 block text-[12px] text-overdue">
              Both passwords must match.
            </span>
          }
        </label>

        @if (error()) {
          <p class="m-0 text-[13px] text-overdue" role="alert">{{ error() }}</p>
        }

        <button type="submit" class="btn btn-primary w-full justify-center py-2.5">
          Create account
        </button>

        <p class="m-0 text-center text-[13px] text-ink-soft">
          Already have one?
          <a routerLink="/login" class="text-accent-bright no-underline hover:underline">
            Sign in
          </a>
        </p>
      </form>
    </lime-auth-layout>
  `,
})
export class SignUp {
  private readonly router = inject(Router);

  protected readonly minLength = MIN_LENGTH;

  protected readonly displayName = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly reveal = signal(false);
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

  /** 0–4, driven mostly by length with a nudge for variety. */
  protected readonly strength = computed(() => {
    const value = this.password();
    if (!value) {
      return 0;
    }

    let score = 0;
    if (value.length >= 8) score++;
    if (value.length >= MIN_LENGTH) score++;
    if (value.length >= 18) score++;
    if (/[^A-Za-z]/.test(value) && /[A-Za-z]/.test(value)) score++;

    return Math.min(score, 4);
  });

  protected readonly strengthLabel = computed(() => {
    const value = this.password();
    if (!value) {
      return `At least ${MIN_LENGTH} characters. A short sentence works well.`;
    }
    if (value.length < MIN_LENGTH) {
      return `${MIN_LENGTH - value.length} more characters needed.`;
    }
    return ['', 'Weak', 'Fair', 'Good', 'Strong'][this.strength()];
  });

  protected readonly strengthColour = computed(() => {
    if (this.password().length < MIN_LENGTH) {
      return 'var(--color-ink-soft)';
    }
    return this.strength() >= 4
      ? 'var(--color-good)'
      : this.strength() === 3
        ? 'var(--color-accent-bright)'
        : 'var(--color-soon)';
  });

  protected showError(field: 'name' | 'email' | 'password' | 'confirm'): boolean {
    if (!this.submitted()) {
      return false;
    }

    switch (field) {
      case 'name':
        return this.displayName().trim().length < 2;
      case 'email':
        return !!this.emailError();
      case 'password':
        return this.password().length < MIN_LENGTH;
      default:
        return this.confirm() !== this.password();
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    this.error.set(null);

    const invalid = (['name', 'email', 'password', 'confirm'] as const).some(
      (field) => this.showError(field),
    );
    if (invalid) {
      return;
    }

    // TODO: POST /api/v1/auth/register, keep the session, then navigate.
    void this.router.navigateByUrl('/overview');
  }
}
