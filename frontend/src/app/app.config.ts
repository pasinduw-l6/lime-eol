import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { actingUserInterceptor } from './core/acting-user';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

/**
 * Zoneless: every state change goes through signals, so Angular is notified
 * explicitly rather than by patching the runtime. State is updated with
 * .set()/.update(), never by mutating a field in place.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([actingUserInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
  ],
};
