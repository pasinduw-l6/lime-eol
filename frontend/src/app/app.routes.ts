import { Routes } from '@angular/router';
import { signedIn, signedOut } from './core/auth.guard';
import { Shell } from './shell';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · Lime Lifecycle',
    canActivate: [signedOut],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'signup',
    title: 'Create account · Lime Lifecycle',
    loadComponent: () => import('./features/auth/sign-up').then((m) => m.SignUp),
  },

  {
    path: '',
    component: Shell,
    canActivate: [signedIn],
    children: [
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
          import('./features/actions/actions').then((m) => m.Actions),
      },
      {
        path: 'calendar',
        title: 'Calendar · Lime Lifecycle',
        loadComponent: () =>
          import('./features/calendar/calendar').then((m) => m.Calendar),
      },

      { path: 'environments', redirectTo: 'projects' },
      { path: 'schedule', redirectTo: 'lifecycle' },
      { path: 'registry', redirectTo: 'lifecycle' },
      { path: 'actions', redirectTo: 'plan' },

      { path: '**', redirectTo: 'overview' },
    ],
  },
];
