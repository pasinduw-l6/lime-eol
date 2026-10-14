import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Page } from './permissions';
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

/** Lets the route through when the person's role shows `data.page`. */
export const canSeePage: CanActivateFn = (route) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return session.canSee(route.data['page'] as Page) ? true : router.createUrlTree(['/overview']);
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
