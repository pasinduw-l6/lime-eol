import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'lime-root',
  imports: [RouterOutlet],
  host: { class: 'block min-h-screen' },
  template: `<router-outlet />`,
})
export class App {}
