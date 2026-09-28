import {
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import gsap from 'gsap';
import { Celebrations } from '../core/celebration.service';

const CONFETTI = [
  'var(--color-lime)',
  'var(--color-lime-bright)',
  'var(--color-accent)',
  'var(--color-accent-bright)',
  'var(--color-soon)',
];

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
          class="card relative flex w-[21rem] items-center gap-3.5 px-4 py-4"
          style="border-color: color-mix(in oklab, var(--color-lime) 55%, transparent)"
        >
          <img
            #photo
            src="/success.jpg"
            alt=""
            class="h-[4.5rem] w-[4.5rem] shrink-0 rounded-[12px] object-cover"
          />

          <span class="min-w-0">
            <span class="block text-[14.5px] font-semibold">{{ party.title }}</span>
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

      this.confetti();
    });
  }

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
      onComplete: () => pieces.forEach((piece) => piece.remove()),
    });
  }
}
