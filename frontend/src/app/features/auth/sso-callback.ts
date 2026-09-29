import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Session, SessionStore } from '../../core/session';
import { AuthLayout } from './auth-layout';

/**
 * Where Microsoft's sign-in lands.
 *
 * The API has already verified the assertion and issued a session; this only
 * has to read it, keep it, and get out of the way. The session arrives in the
 * URL fragment rather than a query string because a fragment is never sent to a
 * server - it stays out of the nginx access log and out of any Referer header.
 */
@Component({
  selector: 'lime-sso-callback',
  imports: [RouterLink, AuthLayout],
  host: { class: 'block' },
  template: `
    <lime-auth-layout
      heading="Signing you in"
      [subheading]="error() ? 'That did not complete.' : 'One moment.'"
    >
      @if (error()) {
        <p class="m-0 text-[13px] text-overdue" role="alert">{{ error() }}</p>
        <a
          routerLink="/login"
          class="btn btn-primary mt-5 w-full justify-center py-2.5 no-underline"
        >
          Back to sign in
        </a>
      } @else {
        <p class="m-0 text-[14px] text-ink-soft" role="status">
          Finishing your sign-in…
        </p>
      }
    </lime-auth-layout>
  `,
})
export class SsoCallback {
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  protected readonly error = signal<string | null>(null);

  constructor() {
    const fragment = new URLSearchParams(
      window.location.hash.replace(/^#/, ''),
    );
    const payload = fragment.get('session');
    const next = fragment.get('next');

    if (!payload) {
      this.error.set('That sign-in link carried no session.');
      return;
    }

    let session: Session;
    try {
      session = JSON.parse(decodeBase64Url(payload)) as Session;
    } catch {
      this.error.set('That sign-in could not be read. Please try again.');
      return;
    }

    if (!session?.token) {
      this.error.set('That sign-in did not include a session token.');
      return;
    }

    this.session.adopt(session);

    // Drop the token out of the address bar, and out of the back button, before
    // navigating on.
    window.history.replaceState({}, '', window.location.pathname);
    void this.router.navigateByUrl(next || '/overview');
  }
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  );
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}
