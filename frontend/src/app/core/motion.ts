import { ElementRef, Injectable } from '@angular/core';
import gsap from 'gsap';

/**
 * Motion, used sparingly and on purpose.
 *
 * This is an operations tool, not a landing page: one orchestrated moment when
 * a screen arrives, and movement when data actually changes. Everything that a
 * CSS transition can do is left to CSS — GSAP is here for the two things it
 * cannot: interpolating a number, and orchestrating a stagger.
 *
 * Every animation is registered through gsap.matchMedia, so a person who has
 * asked for reduced motion gets the final state immediately, not a faster
 * version of the same movement.
 */
@Injectable({ providedIn: 'root' })
export class Motion {
  private readonly media = gsap.matchMedia();

  /** Counts a number up to its value. */
  countUp(target: ElementRef<HTMLElement> | HTMLElement, to: number): void {
    const element = toElement(target);
    if (!element) {
      return;
    }

    this.media.add(
      {
        motion: '(prefers-reduced-motion: no-preference)',
        still: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const { motion } = context.conditions as { motion: boolean };

        if (!motion) {
          element.textContent = String(to);
          return;
        }

        const state = { value: 0 };
        gsap.to(state, {
          value: to,
          duration: Math.min(0.9, 0.25 + to * 0.06),
          ease: 'power2.out',
          onUpdate: () => {
            element.textContent = String(Math.round(state.value));
          },
        });
      },
    );
  }

  /** Reveals a set of elements in sequence — the one arrival moment. */
  stagger(
    host: ElementRef<HTMLElement>,
    selector: string,
    options: { y?: number; each?: number } = {},
  ): void {
    this.media.add('(prefers-reduced-motion: no-preference)', () => {
      const targets = host.nativeElement.querySelectorAll(selector);
      if (targets.length === 0) {
        return;
      }

      gsap.from(targets, {
        opacity: 0,
        y: options.y ?? 8,
        duration: 0.4,
        ease: 'power2.out',
        stagger: options.each ?? 0.05,
        clearProps: 'opacity,transform',
      });
    });
  }

  /** Grows bars from their baseline when the underlying data changes. */
  grow(host: ElementRef<HTMLElement>, selector: string): void {
    this.media.add('(prefers-reduced-motion: no-preference)', () => {
      const targets = host.nativeElement.querySelectorAll(selector);
      if (targets.length === 0) {
        return;
      }

      gsap.from(targets, {
        scaleY: 0,
        transformOrigin: 'bottom center',
        duration: 0.45,
        ease: 'power3.out',
        stagger: 0.025,
        clearProps: 'transform',
      });
    });
  }

  /** Releases every animation this service registered. */
  dispose(): void {
    this.media.revert();
  }
}

function toElement(
  target: ElementRef<HTMLElement> | HTMLElement,
): HTMLElement | null {
  return target instanceof ElementRef ? target.nativeElement : target;
}
