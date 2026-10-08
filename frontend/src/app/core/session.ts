import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Permission, RoleName, can } from './permissions';

export interface Session {
  token: string;
  id: string;
  email: string;
  displayName: string;
  role: RoleName;
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
  readonly isAdmin = computed(() => this.session()?.role === 'ADMIN');

  can(permission: Permission): boolean {
    return can(this.session()?.role, permission);
  }

  adopt(session: Session): void {
    this.keep(session);
  }

  async verify(): Promise<void> {
    if (!this.session()) {
      return;
    }

    try {
      const me = await firstValueFrom(
        this.http.get<{ role: RoleName; displayName: string; initials: string }>('/api/v1/auth/me'),
      );
      const current = this.session();
      if (current && (current.role !== me.role || current.displayName !== me.displayName)) {
        this.keep({ ...current, role: me.role, displayName: me.displayName, initials: me.initials });
      }
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
