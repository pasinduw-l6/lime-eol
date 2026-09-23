import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session';

/**
 * Keeps the signed-out off the app.
 *
 * A convenience, not a control: the API is what actually has to refuse an
 * unauthenticated request, and guarding routes in the browser only decides
 * what gets rendered.
 */
export const signedIn: CanActivateFn = (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (session.isSignedIn()) {
    return true;
  }

  // Remember where they were headed, so signing in lands them there rather
  // than dumping them on the overview.
  return router.createUrlTree(['/login'], {
    queryParams: state.url === '/' ? undefined : { next: state.url },
  });
};

/** Sends an already-signed-in visitor away from the sign-in page. */
export const signedOut: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return session.isSignedIn() ? router.createUrlTree(['/overview']) : true;
};
