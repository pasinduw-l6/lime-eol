import { Component, input, signal } from '@angular/core';
import { Actions } from '../actions/actions';
import { Calendar } from '../calendar/calendar';

/**
 * Plan — what we are doing about it, and when.
 *
 * The same work in two shapes: a list to manage it, a calendar to see when it
 * lands against the deadlines it answers.
 */
@Component({
  selector: 'lime-plan-page',
  imports: [Actions, Calendar],
  host: { class: 'block' },
  template: `
    <nav class="card mb-5 flex flex-wrap gap-1 px-5 py-3" aria-label="Plan views">
      @for (tab of tabs; track tab.key) {
        <button
          type="button"
          class="rounded-full px-4 py-1.5 text-[13px]"
          [class.bg-ink]="view() === tab.key"
          [class.text-ground]="view() === tab.key"
          [class.text-ink-soft]="view() !== tab.key"
          [attr.aria-current]="view() === tab.key"
          (click)="view.set(tab.key)"
        >
          {{ tab.label }}
        </button>
      }
    </nav>

    @if (view() === 'actions') {
      <lime-actions [technology]="technology()" [cycle]="cycle()" />
    } @else {
      <lime-calendar />
    }
  `,
})
export class PlanPage {
  /** Passed straight through from the URL to pre-fill a new action. */
  readonly technology = input<string>('');
  readonly cycle = input<string>('');

  protected readonly tabs = [
    { key: 'actions' as const, label: 'Actions' },
    { key: 'calendar' as const, label: 'Calendar' },
  ];

  protected readonly view = signal<'actions' | 'calendar'>('actions');
}
