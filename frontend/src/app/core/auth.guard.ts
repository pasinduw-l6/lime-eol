import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isViewer } from './permissions';
import { SessionStore } from './session';

export const signedIn: CanActivateFn = (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (session.isSignedIn()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: state.url === '/' ? undefined : { next: state.url },
  });
};

export const isAdmin: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return session.user()?.role === 'ADMIN'
    ? true
    : router.createUrlTree(['/overview']);
};

export const notViewer: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return isViewer(session.user()?.role) ? router.createUrlTree(['/overview']) : true;
};

export const canOpenOps: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return session.can('integration:write') ? true : router.createUrlTree(['/overview']);
};

export const canOpenSettings: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return session.isAdmin() || session.can('lime:write')
    ? true
    : router.createUrlTree(['/overview']);
};

export const signedOut: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return session.isSignedIn() ? router.createUrlTree(['/overview']) : true;
};
