import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { authInterceptor, SessionStore } from './core/session';
import { provideRouter, ViewTransitionInfo, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor]),
    ),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated: markSignIn }),
    ),
    provideAppInitializer(() => inject(SessionStore).verify()),
  ],
};

/** Leaving the sign-in screens gets the longer "entering the app" transition; other navigations a quick fade. */
function markSignIn({ transition, from }: ViewTransitionInfo): void {
  let page = from;
  while (page.firstChild) page = page.firstChild;
  const path = page.routeConfig?.path ?? '';
  if (path !== 'login' && !path.startsWith('auth/')) return;
  const root = document.documentElement;
  root.classList.add('entering-app');
  void transition.finished.finally(() => root.classList.remove('entering-app'));
}
