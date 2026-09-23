import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { SessionStore } from './session';

/**
 * Who a recorded change is attributed to.
 *
 * The signed-in account, now that there is one. This used to be a dropdown of
 * project engineers because anyone could be anyone — which made the history it
 * produced worth very little.
 */
@Injectable({ providedIn: 'root' })
export class ActingUser {
  private readonly session = inject(SessionStore);

  readonly current = computed(() => {
    const user = this.session.user();

    return user
      ? { id: user.id, name: user.displayName, initials: user.initials }
      : { id: '', name: 'an unknown user', initials: '?' };
  });
}

/**
 * Names the acting user on every write.
 *
 * Belt and braces alongside the bearer token: the API reads the token when it
 * has one, and this header keeps attribution working for endpoints that have
 * not been moved behind the guard yet.
 */
export const actingUserInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.method === 'GET') {
    return next(request);
  }

  const actor = inject(ActingUser).current();

  return next(
    actor.id ? request.clone({ setHeaders: { 'x-acting-user': actor.id } }) : request,
  );
};
