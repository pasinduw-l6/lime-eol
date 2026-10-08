import { Component, input, output } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';

@Component({
  selector: 'lime-modal',
  imports: [HlmButton],
  host: { class: 'block' },
  template: `
    <div
      class="animate-in fade-in-0 fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10 duration-150 supports-backdrop-filter:backdrop-blur-xs"
      (click)="dismiss.emit()"
      (keydown.escape)="dismiss.emit()"
      tabindex="-1"
    >
      <div
        class="animate-in fade-in-0 zoom-in-95 relative grid w-full gap-6 rounded-xl bg-popover p-6 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-150"
        [style.max-width]="'min(' + maxWidth() + 'px, 100%)'"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (click)="$event.stopPropagation()"
      >
        <header class="flex flex-col gap-2 pr-8">
          <h2 class="m-0 text-lg leading-none font-semibold">{{ title() }}</h2>
          @if (subtitle()) {
            <p class="m-0 text-sm text-muted-foreground">{{ subtitle() }}</p>
          }
        </header>

        <button
          type="button"
          hlmBtn
          variant="ghost"
          size="icon-sm"
          class="absolute top-4 right-4 text-muted-foreground"
          (click)="dismiss.emit()"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" />
          </svg>
        </button>

        <div>
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class Modal {
  readonly title = input.required<string>();

  readonly maxWidth = input(620);
  readonly subtitle = input<string>('');
  readonly dismiss = output<void>();
}
