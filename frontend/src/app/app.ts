import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root component.
 *
 * Deliberately empty: the signed-in chrome lives in Shell, reached through a
 * layout route, so sign-in and sign-up can render as full pages rather than
 * inside a navigation bar.
 */
@Component({
  selector: 'lime-root',
  imports: [RouterOutlet],
  host: { class: 'block min-h-screen' },
  template: `<router-outlet />`,
})
export class App {}
