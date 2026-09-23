import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'lime-theme';

/**
 * Light or dark, remembered.
 *
 * Starts from the operating system's preference, so the first visit matches
 * what the person already chose for everything else; an explicit pick wins
 * from then on.
 */
@Injectable({ providedIn: 'root' })
export class Theme {
  readonly mode = signal<ThemeMode>(initialMode());

  constructor() {
    effect(() => {
      const mode = this.mode();
      document.documentElement.dataset['theme'] = mode;

      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // Private browsing or blocked storage: the theme still applies for
        // this session, it just will not be remembered.
      }
    });
  }

  toggle(): void {
    this.mode.update((mode) => (mode === 'dark' ? 'light' : 'dark'));
  }
}

function initialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
  } catch {
    // Fall through to the system preference.
  }

  return window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}
