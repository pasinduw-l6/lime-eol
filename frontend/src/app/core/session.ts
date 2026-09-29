import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, tap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

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

  /**
   * Accepts a session the API issued after an identity provider vouched for the
   * person - there is no password to post, so the single sign-on callback hands
   * the finished session straight in.
   */
  adopt(session: Session): void {
    this.keep(session);
  }

  /**
   * Checks the stored token against the server before the app trusts it.
   *
   * `restore` can only see whether the expiry date has passed; it cannot know
   * the server has stopped accepting the token. Rotating the signing secret
   * does exactly that, and left the app believing it was signed in with a
   * credential every request would be refused for. Worse, the signed-out guard
   * then bounced people away from the login page, so there was no way back in
   * short of clearing browser storage.
   *
   * One request at startup removes that whole class of problem.
   */
  async verify(): Promise<void> {
    if (!this.session()) {
      return;
    }

    try {
      await firstValueFrom(this.http.get('/api/v1/auth/me'));
    } catch {
      this.signOut();
    }
  }

  signOut(): void {
    this.session.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
  }

  private keep(session: Session): void {
    this.session.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
    }
  }
}

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

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(SessionStore);
  const router = inject(Router);
  const session = store.user();

  const outgoing = session
    ? request.clone({ setHeaders: { Authorization: `Bearer ${session.token}` } })
    : request;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && session) {
        store.signOut();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
