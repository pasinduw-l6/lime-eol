import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
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

/**
 * Operations accounts only.
 *
 * Sends anyone else to the overview rather than to the login page - they are
 * signed in, the page simply is not theirs. This hides the page; the API is
 * what protects it, since the route name is in the bundle either way.
 */
export const isAdmin: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return session.user()?.role === 'ADMIN'
    ? true
    : router.createUrlTree(['/overview']);
};

export const signedOut: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return session.isSignedIn() ? router.createUrlTree(['/overview']) : true;
};
