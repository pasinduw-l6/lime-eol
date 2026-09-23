import { Component, effect, input, signal } from '@angular/core';

/**
 * Shown while a change is being written.
 *
 * Held back for a moment first: most saves finish in under a second, and a
 * panel that appears and vanishes inside 200ms reads as a glitch rather than
 * feedback. It only appears when the wait is long enough to need explaining.
 */
const APPEAR_AFTER_MS = 450;

@Component({
  selector: 'lime-working',
  host: { class: 'contents' },
  template: `
    @if (visible()) {
      <div
        class="absolute inset-0 z-10 grid place-items-center rounded-[var(--radius-card)]"
        style="background: color-mix(in oklab, var(--color-surface) 82%, transparent)"
        role="status"
        aria-live="polite"
      >
        <div class="grid justify-items-center gap-2 px-6 text-center">
          <img
            src="/working.webp"
            alt=""
            class="working-goose h-28 w-28 object-contain"
          />
          <p class="m-0 text-[14px] font-semibold">{{ label() }}</p>
          <p class="m-0 text-[12px] text-ink-soft">
            Writing the change and its history entry together.
          </p>
        </div>
      </div>
    }
  `,
  styles: `
    /* The drawing is black line art on white, which is invisible on the dark
       theme. Inverting it there keeps one asset working in both. */
    .working-goose {
      mix-blend-mode: multiply;
      animation: goose-work 1.6s ease-in-out infinite;
    }

    :root:not([data-theme='light']) .working-goose {
      mix-blend-mode: normal;
      filter: invert(1);
    }

    @keyframes goose-work {
      0%,
      100% {
        transform: translateY(0) rotate(-1deg);
      }
      50% {
        transform: translateY(-4px) rotate(1deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .working-goose {
        animation: none;
      }
    }
  `,
})
export class Working {
  readonly active = input(false);
  readonly label = input('Recording your change…');

  protected readonly visible = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      clearTimeout(this.timer);

      if (!this.active()) {
        this.visible.set(false);
        return;
      }

      this.timer = setTimeout(() => this.visible.set(true), APPEAR_AFTER_MS);
    });
  }
}
