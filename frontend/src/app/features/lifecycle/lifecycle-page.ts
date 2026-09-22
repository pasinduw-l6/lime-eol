import { Component, signal } from '@angular/core';
import { Registry } from '../registry/registry';
import { Schedule } from '../schedule/schedule';

/**
 * Lifecycle — when support ends.
 *
 * Two views of the same question: the timeline of what we run, and the
 * registry of what we track. They were separate tabs; they belong together,
 * because you look one up to understand the other.
 */
@Component({
  selector: 'lime-lifecycle-page',
  imports: [Schedule, Registry],
  host: { class: 'block' },
  template: `
    <nav class="card mb-5 flex flex-wrap gap-1 px-5 py-3" aria-label="Lifecycle views">
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

    @if (view() === 'timeline') {
      <lime-schedule />
    } @else {
      <lime-registry />
    }
  `,
})
export class LifecyclePage {
  protected readonly tabs = [
    { key: 'timeline' as const, label: 'Timeline' },
    { key: 'registry' as const, label: 'Registry' },
  ];

  protected readonly view = signal<'timeline' | 'registry'>('timeline');
}
