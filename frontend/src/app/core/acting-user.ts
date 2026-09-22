import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from './api';

/**
 * Who is acting.
 *
 * Stands in for the signed-in user until Entra ID lands. Every write carries
 * the chosen person's id in a header, which is the same shape a token-derived
 * identity will have — so the server keeps attributing changes exactly as it
 * does now, and only the source of the id changes.
 */
@Injectable({ providedIn: 'root' })
export class ActingUser {
  private readonly api = inject(Api);

  /** Everyone staffed on any project can act. */
  readonly people = computed(() => {
    const seen = new Map<string, { id: string; name: string; initials: string }>();
    for (const project of this.api.projects()) {
      for (const engineer of project.engineers) {
        seen.set(engineer.id, engineer);
      }
    }
    return [...seen.values()];
  });

  private readonly chosenId = signal<string | null>(null);

  readonly current = computed(
    () => this.people().find((p) => p.id === this.chosenId()) ?? this.people()[0] ?? null,
  );

  choose(id: string): void {
    this.chosenId.set(id);
  }
}

/** Adds the acting user to every write, so the server can attribute it. */
export const actingUserInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.method === 'GET') {
    return next(request);
  }

  const actor = inject(ActingUser).current();
  return next(
    actor ? request.clone({ setHeaders: { 'x-acting-user': actor.id } }) : request,
  );
};
