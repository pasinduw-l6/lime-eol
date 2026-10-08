import { Component, inject } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { Feedback } from '../core/feedback';

@Component({
  selector: 'lime-feedback-host',
  imports: [HlmButton],
  template: `
    <ol
      class="no-print pointer-events-none fixed right-4 bottom-4 z-[60] m-0 grid w-[min(380px,calc(100vw-2rem))] list-none gap-2 p-0"
      aria-live="polite"
    >
      @for (toast of feedback.toasts(); track toast.id) {
        <li
          class="animate-in fade-in-0 slide-in-from-bottom-2 pointer-events-auto flex items-start gap-3 rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"
          [style.border-color]="toast.tone === 'error' ? 'color-mix(in oklab, var(--destructive) 40%, transparent)' : ''"
          [attr.role]="toast.tone === 'error' ? 'alert' : 'status'"
        >
          <span
            class="mt-1.5 size-2 shrink-0 rounded-full"
            [class.bg-success]="toast.tone === 'success'"
            [class.bg-destructive]="toast.tone === 'error'"
            [class.bg-info]="toast.tone === 'info'"
            aria-hidden="true"
          ></span>
          <span class="flex-1">{{ toast.message }}</span>
          @if (toast.action; as action) {
            <button
              type="button"
              class="font-medium text-primary hover:underline"
              (click)="action.run(); feedback.dismiss(toast.id)"
            >
              {{ action.label }}
            </button>
          }
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
            (click)="feedback.dismiss(toast.id)"
          >
            ×
          </button>
        </li>
      }
    </ol>

    @if (feedback.pending(); as ask) {
      <div
        class="animate-in fade-in-0 fixed inset-0 z-[70] grid place-items-center bg-black/50 px-4 supports-backdrop-filter:backdrop-blur-xs"
        (click)="feedback.answer(false)"
        (keydown.escape)="feedback.answer(false)"
        tabindex="-1"
      >
        <div
          class="animate-in fade-in-0 zoom-in-95 grid w-full max-w-md gap-4 rounded-xl bg-popover p-6 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-label]="ask.title"
          (click)="$event.stopPropagation()"
        >
          <div class="grid gap-2">
            <h2 class="m-0 text-lg leading-none font-semibold">{{ ask.title }}</h2>
            <p class="m-0 text-sm text-muted-foreground">{{ ask.message }}</p>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="feedback.answer(false)">Cancel</button>
            <button
              type="button"
              hlmBtn
              [variant]="ask.destructive ? 'destructive' : 'default'"
              (click)="feedback.answer(true)"
            >
              {{ ask.confirmLabel ?? 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class FeedbackHost {
  protected readonly feedback = inject(Feedback);
}
