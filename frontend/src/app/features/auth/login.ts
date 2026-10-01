import { Component, computed, input } from '@angular/core';
import { AuthLayout } from './auth-layout';

const SSO_LOGIN_PATH = '/api/v1/auth/oidc/login';

@Component({
  selector: 'lime-login',
  imports: [AuthLayout],
  host: { class: 'block' },
  template: `
    <lime-auth-layout
      heading="Sign in"
      subheading="Changes you record are attributed to your account."
    >
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
    </lime-auth-layout>
  `,
})
export class Login {
  readonly next = input<string>('');

  readonly failure = input<string>('', { alias: 'error' });

  protected readonly shownError = computed(() =>
    failureMessage(this.failure()),
  );

  protected startSso(): void {
    const next = this.next();
    window.location.href = next
      ? `${SSO_LOGIN_PATH}?next=${encodeURIComponent(next)}`
      : SSO_LOGIN_PATH;
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
