import { Routes } from '@angular/router';

/**
 * Four sections, each answering one question. Older paths redirect, so links
 * shared before the consolidation still work.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'overview',
    title: 'Overview · Lime Lifecycle',
    loadComponent: () =>
      import('./features/overview/overview').then((m) => m.Overview),
  },
  {
    path: 'projects',
    title: 'Projects · Lime Lifecycle',
    loadComponent: () =>
      import('./features/projects/projects').then((m) => m.Projects),
  },
  {
    path: 'lifecycle',
    title: 'Lifecycle · Lime Lifecycle',
    loadComponent: () =>
      import('./features/lifecycle/lifecycle-page').then((m) => m.LifecyclePage),
  },
  {
    // Query params bind straight to the component's inputs, so
    // /plan?technology=…&cycle=… opens the form already filled in.
    path: 'plan',
    title: 'Plan · Lime Lifecycle',
    loadComponent: () =>
      import('./features/actions/actions').then((m) => m.Actions),
  },
  {
    path: 'calendar',
    title: 'Calendar · Lime Lifecycle',
    loadComponent: () =>
      import('./features/calendar/calendar').then((m) => m.Calendar),
  },

  // consolidated away
  { path: 'environments', redirectTo: 'projects' },
  { path: 'schedule', redirectTo: 'lifecycle' },
  { path: 'registry', redirectTo: 'lifecycle' },
  { path: 'actions', redirectTo: 'plan' },

  { path: '**', redirectTo: 'overview' },
];
