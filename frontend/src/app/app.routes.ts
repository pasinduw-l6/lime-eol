import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'overview',
    title: 'Overview · Lime Lifecycle',
    loadComponent: () =>
      import('./features/overview/overview').then((m) => m.Overview),
  },
  {
    path: 'schedule',
    title: 'Schedule · Lime Lifecycle',
    loadComponent: () =>
      import('./features/schedule/schedule').then((m) => m.Schedule),
  },
  {
    path: 'environments',
    title: 'Environments · Lime Lifecycle',
    loadComponent: () =>
      import('./features/environments/environments').then(
        (m) => m.Environments,
      ),
  },
  {
    path: 'calendar',
    title: 'Calendar · Lime Lifecycle',
    loadComponent: () =>
      import('./features/calendar/calendar').then((m) => m.Calendar),
  },
  { path: '**', redirectTo: 'overview' },
];
