import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  input,
  output,
  viewChild,
} from '@angular/core';
import gsap from 'gsap';

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
      #backdrop
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10"
      style="background: rgb(0 0 0 / 45%); backdrop-filter: blur(6px)"
      (click)="dismiss.emit()"
      (keydown.escape)="dismiss.emit()"
      tabindex="-1"
    >
      <div
        #panel
        class="card w-full max-w-[min(620px,100%)] px-7 py-6"
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
export class Modal implements AfterViewInit, OnDestroy {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly dismiss = output<void>();

  private readonly backdrop = viewChild<ElementRef<HTMLElement>>('backdrop');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly media = gsap.matchMedia();

  /**
   * The sheet springs up rather than appearing, which is what makes a dialog
   * feel like it came from somewhere. One movement, and only when motion is
   * welcome.
   */
  ngAfterViewInit(): void {
    const backdrop = this.backdrop()?.nativeElement;
    const panel = this.panel()?.nativeElement;

    if (!backdrop || !panel) {
      return;
    }

    this.media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(backdrop, { opacity: 0, duration: 0.18, ease: 'power1.out' });
      gsap.from(panel, {
        opacity: 0,
        y: 18,
        scale: 0.97,
        duration: 0.42,
        ease: 'back.out(1.4)',
        clearProps: 'transform',
      });
    });
  }

  ngOnDestroy(): void {
    this.media.revert();
  }
}
