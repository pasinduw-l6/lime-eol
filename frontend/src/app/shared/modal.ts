import { Component, input, output } from '@angular/core';

/**
 * Dialog used by every create/edit form, so they behave identically:
 * Escape closes, the backdrop closes, the panel does not, and the heading is
 * announced.
 */
@Component({
  selector: 'lime-modal',
  host: { class: 'block' },
  template: `
    <div
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10"
      (click)="dismiss.emit()"
      (keydown.escape)="dismiss.emit()"
      tabindex="-1"
    >
      <div
        class="card w-full max-w-[min(620px,100%)] px-7 py-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (click)="$event.stopPropagation()"
      >
        <header class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 class="m-0 text-[19px] font-semibold tracking-[-0.01em]">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="m-0 text-[13px] text-ink-soft">{{ subtitle() }}</p>
            }
          </div>
          <button
            type="button"
            class="rounded-full px-2 text-[18px] text-ink-soft hover:text-ink"
            (click)="dismiss.emit()"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <ng-content />
      </div>
    </div>
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly dismiss = output<void>();
}
