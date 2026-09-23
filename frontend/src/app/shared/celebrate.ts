import {
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import gsap from 'gsap';
import { Celebrations } from '../core/celebration.service';

/** Brand colours only, so a burst still looks like the product. */
const CONFETTI = [
  'var(--color-lime)',
  'var(--color-lime-bright)',
  'var(--color-accent)',
  'var(--color-accent-bright)',
  'var(--color-soon)',
];

/**
 * The reward for recording a change.
 *
 * Mounted once in the shell and driven by a signal, so any screen can set one
 * off without owning the animation. Never blocks: pointer events pass straight
 * through, and it leaves on its own, so there is nothing to dismiss.
 */
@Component({
  selector: 'lime-celebrate',
  host: { class: 'block' },
  template: `
    @if (celebrations.current(); as party) {
      <div
        class="pointer-events-none fixed right-5 bottom-5 z-[60]"
        role="status"
        aria-live="polite"
      >
        <div #burst class="pointer-events-none absolute inset-0"></div>

        <div
          #card
          class="card relative flex w-[19rem] items-center gap-3 px-4 py-3.5"
          [style.border-color]="
            party.tier === 'ROUTINE' ? null : 'color-mix(in oklab, var(--color-lime) 55%, transparent)'
          "
        >
          @if (party.tier === 'ROUTINE') {
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[18px]"
              style="background: color-mix(in oklab, var(--color-good) 18%, transparent); color: var(--color-good)"
              aria-hidden="true"
            >
              ✓
            </span>
          } @else {
            <img
              #photo
              src="/success.jpg"
              alt=""
              class="h-14 w-14 shrink-0 rounded-[10px] object-cover"
            />
          }

          <span class="min-w-0">
            <span class="block text-[14px] font-semibold">{{ party.title }}</span>
            <span class="block text-[12px] text-ink-soft">{{ party.detail }}</span>
          </span>
        </div>
      </div>
    }
  `,
})
export class Celebrate {
  protected readonly celebrations = inject(Celebrations);

  private readonly card = viewChild<ElementRef<HTMLElement>>('card');
  private readonly burst = viewChild<ElementRef<HTMLElement>>('burst');
  private readonly photo = viewChild<ElementRef<HTMLElement>>('photo');

  constructor() {
    effect(() => {
      const party = this.celebrations.current();
      const card = this.card()?.nativeElement;

      if (!party || !card) {
        return;
      }

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      // Springs up rather than fading in: this is the one moment in the tool
      // that is allowed to be pleased with itself.
      gsap.from(card, {
        opacity: 0,
        y: 22,
        scale: 0.92,
        duration: 0.42,
        ease: 'back.out(1.5)',
        clearProps: 'opacity,transform',
      });

      const photo = this.photo()?.nativeElement;
      if (photo) {
        gsap.fromTo(
          photo,
          { rotate: -7 },
          { rotate: 0, duration: 0.6, ease: 'elastic.out(1, 0.45)', clearProps: 'rotate' },
        );
      }

      if (party.tier !== 'ROUTINE') {
        this.confetti();
      }
    });
  }

  /**
   * A burst of brand-coloured squares, built and torn down in place.
   *
   * Hand-rolled rather than pulled from a library: it is forty divs and one
   * tween, and a dependency for that would outweigh it.
   */
  private confetti(): void {
    const host = this.burst()?.nativeElement;
    if (!host) {
      return;
    }

    const pieces: HTMLElement[] = [];

    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('span');
      piece.style.cssText = `
        position:absolute; left:50%; top:60%;
        width:${gsap.utils.random(4, 9)}px; height:${gsap.utils.random(4, 11)}px;
        background:${CONFETTI[i % CONFETTI.length]};
        border-radius:${Math.random() > 0.6 ? '50%' : '1px'};
      `;
      host.appendChild(piece);
      pieces.push(piece);
    }

    gsap.to(pieces, {
      x: () => gsap.utils.random(-190, 190),
      y: () => gsap.utils.random(-170, 60),
      rotation: () => gsap.utils.random(-320, 320),
      opacity: 0,
      duration: () => gsap.utils.random(0.9, 1.5),
      ease: 'power2.out',
      // Removed on completion; leaving forty absolutely positioned nodes behind
      // on every upgrade would accumulate for the life of the session.
      onComplete: () => pieces.forEach((piece) => piece.remove()),
    });
  }
}
