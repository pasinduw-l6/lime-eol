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
    path: 'plan',
    title: 'Plan · Lime Lifecycle',
    loadComponent: () =>
      import('./features/plan/plan-page').then((m) => m.PlanPage),
  },

  // consolidated away
  { path: 'environments', redirectTo: 'projects' },
  { path: 'schedule', redirectTo: 'lifecycle' },
  { path: 'registry', redirectTo: 'lifecycle' },
  { path: 'actions', redirectTo: 'plan' },
  { path: 'calendar', redirectTo: 'plan' },

  { path: '**', redirectTo: 'overview' },
];
