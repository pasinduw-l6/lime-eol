import { Component, input } from '@angular/core';

/**
 * How long the goose stays up, whatever the server does.
 *
 * A save against a warm cache finishes in about 20ms, and something that
 * appears and vanishes that fast reads as a glitch rather than feedback. The
 * caller holds its modal open for at least this long so the panel is actually
 * seen — see `update-component.ts`.
 */
export const MIN_WORKING_MS = 2000;

/** Shown while a change is being written. */
@Component({
  selector: 'lime-working',
  host: { class: 'contents' },
  template: `
    @if (active()) {
      <div
        class="absolute inset-0 z-10 grid place-items-center rounded-[var(--radius-card)]"
        style="background: color-mix(in oklab, var(--color-surface) 88%, transparent)"
        role="status"
        aria-live="polite"
      >
        <div class="grid justify-items-center gap-2 px-6 text-center">
          <img
            src="/working.webp"
            alt=""
            class="working-goose h-32 w-32 object-contain"
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
      animation:
        goose-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both,
        goose-work 1.6s ease-in-out 320ms infinite;
    }

    :root:not([data-theme='light']) .working-goose {
      mix-blend-mode: normal;
      filter: invert(1);
    }

    @keyframes goose-in {
      from {
        opacity: 0;
        transform: scale(0.88);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    @keyframes goose-work {
      0%,
      100% {
        transform: translateY(0) rotate(-1.5deg);
      }
      50% {
        transform: translateY(-5px) rotate(1.5deg);
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
}
