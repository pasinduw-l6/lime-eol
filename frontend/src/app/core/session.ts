import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';

export interface Session {
  token: string;
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  initials: string;
  expiresAt: string;
}

const STORAGE_KEY = 'lime.session';

/**
 * Who is signed in.
 *
 * Kept in localStorage so a refresh does not sign you out mid-change. That
 * puts the token where page scripts can read it, which is the accepted
 * trade-off for a first-party tool on an internal network — the alternative is
 * an httpOnly cookie, which needs CSRF handling the API does not have yet.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly http = inject(HttpClient);

  private readonly session = signal<Session | null>(restore());

  readonly user = this.session.asReadonly();
  readonly isSignedIn = computed(() => this.session() !== null);
  readonly canEdit = computed(() => this.session()?.role !== 'VIEWER');

  signIn(email: string, password: string) {
    return this.http
      .post<Session>('/api/v1/auth/login', { email, password })
      .pipe(tap((session) => this.keep(session)));
  }

  signOut(): void {
    this.session.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private browsing, or site data blocked. Signing out of this tab is
      // still the important half.
    }
  }

  private keep(session: Session): void {
    this.session.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // The session still works for this tab; it just will not survive a
      // refresh.
    }
  }
}

/** Reads a stored session, ignoring one that has already expired. */
function restore(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw) as Session;
    if (!session?.token || Date.parse(session.expiresAt) <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/** Sends the token on every request, so the API can attribute and authorise. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionStore).user();

  return next(
    session
      ? request.clone({ setHeaders: { Authorization: `Bearer ${session.token}` } })
      : request,
  );
};
