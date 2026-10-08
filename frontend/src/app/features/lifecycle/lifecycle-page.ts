import { Component, signal } from '@angular/core';
import { Registry } from '../registry/registry';
import { Schedule } from '../schedule/schedule';
import { HlmCardImports } from '@spartan-ng/helm/card';

@Component({
  selector: 'lime-lifecycle-page',
  imports: [HlmCardImports, Schedule, Registry],
  host: { class: 'block' },
  template: `
    <nav class="segmented mb-6" aria-label="Lifecycle views">
      @for (tab of tabs; track tab.key) {
        <button
          type="button"
          class="px-4 py-1 text-sm"
          [class.bg-background]="view() === tab.key"
          [class.shadow-sm]="view() === tab.key"
          [class.text-foreground]="view() === tab.key"
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
